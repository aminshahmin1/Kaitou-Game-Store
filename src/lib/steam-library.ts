import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { createSupabaseAdminClient } from "./supabase/admin";
import { getFundingCostBasis } from "./funding-cost";
import { getAvailableSupplierCredit } from "./supplier-credit";
import { applyBalanceAvailability } from "./stock";
import { getFazerCardsCatalogDetails } from "./integrations/fazercards-catalog";
import { steamSellingPrice } from "./steam-pricing";
import type { Product } from "./types";

const gameFeedItem = z.object({ appid: z.number().int().positive(), name: z.string().trim().min(1).transform((value) => value.slice(0,500)) });
const gameFeed = z.object({ ok: z.literal(true), meta: z.object({ truncated: z.literal(false) }), games: z.array(z.unknown()).min(1) });
const metadataSchema = z.object({ success: z.boolean(), data: z.object({ type: z.string(), name: z.string(), steam_appid: z.number(), is_free: z.boolean(), header_image: z.url(), short_description: z.string().optional() }).optional() });
export type SteamLibraryEntry = { appid: number; name: string; imageUrl: string; description: string };
function database() { const db = createSupabaseAdminClient(); if (!db) throw new Error("Catalogue unavailable."); return db; }
function appId(input: string | number) { const id = Number(input); if (!Number.isSafeInteger(id) || id < 1) throw new Error("Invalid game."); return id; }
function safeImage(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || !/(^|\.)(steamstatic\.com|steamusercontent\.com)$/.test(parsed.hostname)) throw new Error("Invalid game image.");
  return url;
}
async function takeSteamBudget() {
  const { data, error } = await database().rpc("consume_request_limit", { p_key: createHash("sha256").update("steam-store-metadata-v1").digest("hex"), p_limit: 90, p_seconds: 300 });
  if (error || !data?.[0]?.allowed) throw new Error("Game checks are busy. Please try again shortly.");
}

async function packageContainsGame(subid: number, appid: number) {
  const db = database();
  const { data: cached, error } = await db.from("steam_library_packages").select("appids,checked_at").eq("subid",subid).maybeSingle();
  if (error) throw new Error("Edition check unavailable.");
  if (cached && Date.now()-new Date(cached.checked_at).getTime()<24*3600000) return cached.appids.map(Number).includes(appid);
  await takeSteamBudget();
  const response = await fetch(`https://store.steampowered.com/api/packagedetails?packageids=${subid}&cc=MY&l=english`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Edition check unavailable.");
  const body = await response.json();
  const result = z.object({ success: z.literal(true), data: z.object({ apps: z.array(z.object({ id: z.number().int().positive() })) }) }).parse(body[String(subid)]);
  const appids = result.data.apps.map((app) => app.id);
  const { error: saveError } = await db.from("steam_library_packages").upsert({ subid, appids, checked_at: new Date().toISOString() });
  if (saveError) throw new Error("Edition check could not be saved.");
  return appids.includes(appid);
}

export async function syncSteamCatalogue(progress?: (stage: string) => void, runBudgetMs = 25000) {
  const db = database();
  progress?.("Claiming catalogue refresh");
  const { data: token, error: claimError } = await db.rpc("claim_steam_catalog_sync").abortSignal(AbortSignal.timeout(10000));
  if (claimError) throw new Error("Catalogue sync could not start.");
  if (!token) return { imported: 0, remaining: 0, skipped: true };
  try {
    const key = process.env.FAZERCARDS_API_KEY;
    if (!key) throw new Error("Supplier unavailable.");
    const response = await fetch(`${process.env.FAZERCARDS_API_BASE_URL ?? "https://api.fzr.cards/api/v2"}/steam-gifts/games`, {
      headers: { "X-API-Key": key, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(20000),
    });
    progress?.(`Supplier response HTTP ${response.status}`);
    if (!response.ok) throw new Error(`Supplier catalogue unavailable (HTTP ${response.status}). Check the API subscription.`);
    const body = gameFeed.parse(await response.json());
    const valid = body.games.map((game) => gameFeedItem.safeParse(game)).flatMap((result) => result.success ? [result.data] : []);
    if (!valid.length) throw new Error("The supplier catalogue contains no valid games.");
    const games = [...new Map(valid.map((game) => [game.appid, game])).values()];
    const hash = createHash("sha256").update(JSON.stringify(games)).digest("hex");
    const { data: cursor, error } = await db.rpc("begin_steam_catalog_chunks", { p_token: token, p_total: games.length, p_hash: hash }).abortSignal(AbortSignal.timeout(10000));
    if (error) throw new Error("Catalogue import could not start.", { cause: { code: error.code, message: error.message } });
    const deadline=Date.now()+runBudgetMs;
    let offset=Number(cursor),imported=0;
    do {
      const chunk=games.slice(offset,offset+2000);
      const { data, error: chunkError } = await db.rpc("ingest_steam_catalog_chunk", { p_token: token, p_games: chunk, p_offset: offset }).abortSignal(AbortSignal.timeout(15000));
      if (chunkError) throw new Error("Catalogue chunk could not be saved.", { cause: { code: chunkError.code, message: chunkError.message } });
      offset+=Number(data.processed); imported+=Number(data.processed);
      progress?.(`Indexed ${offset} of ${games.length} catalogue entries`);
    } while(offset<games.length && Date.now()<deadline);
    if (offset<games.length) await db.from("steam_library_sync").update({ lease_until: new Date().toISOString() }).eq("lease_token",token);
    return { imported, remaining: games.length-offset, skipped: false };
  } catch (error) {
    await db.from("steam_library_sync").update({ lease_until: new Date(Date.now() + 10 * 60000).toISOString() }).eq("lease_token", token);
    throw error;
  }
}

export async function verifySteamGame(input: number | string): Promise<SteamLibraryEntry | null> {
  const id = appId(input), db = database();
  const { data: cached, error } = await db.from("steam_library_games").select("appid,name,supplier_active,metadata_status,metadata_checked_at,image_url,description").eq("appid", id).maybeSingle();
  if (error || !cached?.supplier_active) return null;
  if (cached.metadata_checked_at && Date.now() - new Date(cached.metadata_checked_at).getTime() < 24 * 3600000) {
    return cached.metadata_status === "eligible" && cached.image_url ? { appid: id, name: cached.name, imageUrl: cached.image_url, description: cached.description ?? "" } : null;
  }
  // A shared store-wide budget protects Steam, including concurrent visitors and workers.
  await takeSteamBudget();
  await db.from("steam_library_games").update({ metadata_attempt_at: new Date().toISOString() }).eq("appid", id);
  const response = await fetch(`https://store.steampowered.com/api/appdetails?appids=${id}&cc=MY&l=english`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Steam game details are unavailable.");
  const raw = await response.json();
  const parsed = metadataSchema.parse(raw[String(id)]);
  // Never guess from the name: DLC, demos, free games and unresolved types stay hidden.
  const data = parsed.data;
  if (!parsed.success || !data) throw new Error("Steam game details could not be verified.");
  if (data.steam_appid !== id) throw new Error("Steam game identity mismatch.");
  const eligible = data.type === "game" && data.is_free === false;
  const imageUrl = safeImage(data.header_image);
  const description = "";
  const { error: saveError } = await db.from("steam_library_games").update({ metadata_status: eligible ? "eligible" : "excluded", metadata_checked_at: new Date().toISOString(), image_url: imageUrl, description }).eq("appid", id);
  if (saveError) throw new Error("Game details could not be saved.");
  return eligible ? { appid: id, name: cached.name, imageUrl, description } : null;
}

export async function verifyPendingSteamGames(limit = 4) {
  const db = database();
  const { data, error } = await db.from("steam_library_games").select("appid").eq("supplier_active", true).eq("metadata_status", "pending")
    .or(`metadata_attempt_at.is.null,metadata_attempt_at.lt.${new Date(Date.now() - 3600000).toISOString()}`).order("source_rank").limit(limit);
  if (error) throw new Error("Catalogue checks unavailable.");
  let verified = 0, checked = 0;
  const deadline = Date.now()+15000;
  for (const row of data ?? []) { if (Date.now()>deadline-8000) break; checked++; try { if (await verifySteamGame(row.appid)) verified++; } catch { break; } }
  return { checked, verified };
}

export async function searchSteamLibrary(query = "", page = 1) {
  const db = database(), q = query.trim().slice(0, 100), offset = (Math.max(1, Math.min(10000, page)) - 1) * 24;
  const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  let partial = false;
  if (q) {
    const { data: candidates, error } = await db.from("steam_library_games").select("appid").eq("supplier_active", true).eq("metadata_status", "pending").ilike("name", pattern).order("source_rank").limit(8);
    if (error) throw new Error("Search unavailable.");
    for (const candidate of candidates ?? []) { try { await verifySteamGame(candidate.appid); } catch { partial = true; break; } }
  }
  let request = db.from("steam_library_games").select("appid,name,image_url,description", { count: "exact" }).eq("supplier_active", true).eq("metadata_status", "eligible");
  if (q) request = request.ilike("name", pattern);
  const { data, count, error } = await request.order("source_rank").range(offset, offset + 23);
  if (error) throw new Error("Search unavailable.");
  return { items: (data ?? []).map((row): SteamLibraryEntry => ({ appid: Number(row.appid), name: row.name, imageUrl: row.image_url, description: row.description ?? "" })), total: count ?? 0, partial };
}

export async function prepareSteamProduct(input: number | string): Promise<Product | null> {
  const id = appId(input), game = await verifySteamGame(id);
  if (!game) return null;
  const db = database(), basis = await getFundingCostBasis();
  if (!basis) throw new Error("Selling prices are unavailable.");
  const details = await getFazerCardsCatalogDetails("steam_gift", String(id), game.name);
  if (Number(details.categoryId) !== id) throw new Error("Game quote identity mismatch.");
  const candidates = details.offers.filter((offer) => Number.isFinite(offer.priceUsd) && offer.priceUsd > 0 && /^[0-9]+:[A-Z0-9_-]{2,12}$/i.test(String(offer.offerId)));
  const approvedSubs = new Set<number>();
  for (const subid of new Set(candidates.map((offer) => Number(String(offer.offerId).split(":")[0])))) {
    if (await packageContainsGame(subid,id)) approvedSubs.add(subid);
  }
  const offers = candidates.filter((offer) => approvedSubs.has(Number(String(offer.offerId).split(":")[0])));
  const slug = `steam-library-${id}`;
  // Auto-library records have their own namespace; never replace a seller's manual listing.
  const { error: productError } = await db.from("products").upsert({ slug, title: game.name.slice(0,160), game: game.name.slice(0,120), type: "steam_gift_game", category: "Steam Gift Games", region: "Global", delivery_type: "Steam gift", source: "steam_library", fazercards_product_id: String(id), image_tone: "bg-sky-950", image_url: game.imageUrl, required_fields: [{ key: "steam_invite_url", label: "Steam invite link", placeholder: "https://s.team/p/...", type: "text" }], description: game.description, active: true, available: true }, { onConflict: "slug", ignoreDuplicates: true });
  if (productError) throw new Error("Game listing unavailable.");
  const { data: stored, error: storedError } = await db.from("products").select("id,active,available,source").eq("slug", slug).single();
  if (storedError || stored.source !== "steam_library") throw new Error("Game listing unavailable.");
  const rows = offers.map((offer, index) => ({ product_id: stored.id, sku: `steam-${id}-${offer.offerId}`, fazercards_sku: `${id}:${offer.offerId}`, title: offer.name.slice(0,120), cost_usd: offer.priceUsd, ...(() => { const p = steamSellingPrice(offer.priceUsd,basis.rate); return { cost_myr: p.costMyr, price_myr: p.priceMyr }; })(), active: true, available: true, sort_order: index }));
  // Insert new regions/editions, then update price fields only; manual disabling wins.
  if (rows.length) {
    const { error } = await db.from("product_variations").upsert(rows, { onConflict: "product_id,sku", ignoreDuplicates: true });
    if (error) throw new Error("Game editions unavailable.");
    const { error: priceError } = await db.rpc("price_steam_library_variations", { p_product_id: stored.id, p_rows: rows, p_rate: basis.rate });
    if (priceError) throw new Error("Game prices unavailable.");
  }
  const { data: variations, error: variationsError } = await db.from("product_variations").select("id,sku,active,available").eq("product_id", stored.id);
  if (variationsError) throw new Error("Game editions unavailable.");
  const bySku = new Map((variations ?? []).map((row) => [row.sku, row]));
  const product: Product = { id: stored.id, slug, title: game.name, game: game.name, type: "steam_gift_game", category: "Steam Gift Games", region: "Global", deliveryType: "Steam gift", imageTone: "bg-sky-950", imageUrl: game.imageUrl, active: stored.active, available: stored.active && stored.available, fazercardsProductId: String(id), requiredFields: [{ key: "steam_invite_url", label: "Steam invite link", placeholder: "https://s.team/p/...", type: "text" }],
    variations: rows.map((row, index) => { const saved = bySku.get(row.sku); if (!saved) throw new Error("Edition unavailable."); return { id: saved.id, title: row.title, edition: offers[index].edition ?? row.title, region: offers[index].region, sku: row.sku, fazercardsSku: row.fazercards_sku, costUsd: row.cost_usd, costMyr: row.cost_myr, priceMyr: row.price_myr, active: saved.active, available: saved.available, supplierQuantity: 1 }; }) };
  await db.from("steam_library_games").update({ product_id: stored.id }).eq("appid", id);
  return applyBalanceAvailability([product], await getAvailableSupplierCredit().catch(() => null))[0];
}
