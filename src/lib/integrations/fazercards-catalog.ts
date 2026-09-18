import type { RequiredField } from "@/lib/types";

const defaultBaseUrl = "https://api.fzr.cards/api/v2";

export type FazerCardsCatalogKind = "topup" | "gift_card" | "steam_gift";

type FazerCardsTopupCategory = {
  category_id: string;
  name: string;
  note?: string;
  imageurl?: string | null;
};

type FazerCardsTopupOffer = {
  offer_id?: string | null;
  name: string;
  price_usd: string;
};

type FazerCardsField = {
  key: string;
  label: string;
  type?: string;
  options?: Array<{ label?: string; value?: string; name?: string } | string>;
};

export type FazerCardsCatalogItem = {
  id: string;
  name: string;
  kind: FazerCardsCatalogKind;
  note: string | null;
  imageUrl: string | null;
  score?: number;
};

export type FazerCardsCatalogSearchResult = {
  items: FazerCardsCatalogItem[];
  warnings: string[];
};

export type FazerCardsCatalogDetails = {
  kind: FazerCardsCatalogKind;
  categoryId: string;
  name: string;
  note: string | null;
  imageUrl: string | null;
  fields: RequiredField[];
  offers: Array<{
    offerId: string | number;
    name: string;
    priceUsd: number;
    stock?: number;
    minOrderQuantity?: number;
    maxOrderQuantity?: number;
    region?: string;
  }>;
};

function getConfig() {
  const apiKey = process.env.FAZERCARDS_API_KEY;
  const apiBaseUrl = process.env.FAZERCARDS_API_BASE_URL ?? defaultBaseUrl;

  if (!apiKey) {
    throw new Error("FazerCards API key is not configured.");
  }

  return { apiKey, apiBaseUrl };
}

async function fazerCardsFetch<T>(path: string) {
  const { apiKey, apiBaseUrl } = getConfig();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      Accept: "application/json",
      "X-API-Key": apiKey,
    },
    cache: "no-store",
  });

  const body = (await response.json().catch(() => null)) as T | null;

  if (!response.ok || !body) {
    const errorBody = body as { error?: string; code?: string } | null;
    throw new Error(errorBody?.error ?? `FazerCards request failed for ${path}.`);
  }

  return body;
}

export async function listFazerCardsTopups() {
  return listFazerCardsCatalog("topup");
}

export async function listFazerCardsCatalog(kind: FazerCardsCatalogKind, query = "") {
  if (kind === "steam_gift") {
    const body = await fazerCardsFetch<{
      games?: Array<{ appid: number; name: string }>;
    }>("/steam-gifts/games?limit=500");
    return rankCatalogItems(
      (body.games ?? [])
      .map((game): FazerCardsCatalogItem => ({
        id: String(game.appid),
        name: game.name,
        kind,
        note: "Steam gift game",
        imageUrl: null,
      })),
      query,
    );
  }

  const params = new URLSearchParams({ limit: "500", include_ui: "1" });
  const path = kind === "gift_card" ? "/giftcards" : "/topups";
  const body = await fazerCardsFetch<{ items?: FazerCardsTopupCategory[] }>(`${path}?${params.toString()}`);

  return rankCatalogItems(
    (body.items ?? [])
    .map((item): FazerCardsCatalogItem => ({
      id: item.category_id,
      name: item.name,
      kind,
      note: item.note ?? null,
      imageUrl: item.imageurl ?? null,
    })),
    query,
  );
}

export async function searchAllFazerCardsCatalog(query = ""): Promise<FazerCardsCatalogSearchResult> {
  const warnings: string[] = [];
  const results = await Promise.allSettled([
    listFazerCardsCatalog("topup", query),
    listFazerCardsCatalog("gift_card", query),
    listFazerCardsCatalog("steam_gift", query),
  ]);

  const labels = ["top-up", "gift card", "Steam gift"];
  const items = results.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }

    const message = result.reason instanceof Error ? result.reason.message : "Provider search failed.";
    warnings.push(`${labels[index]} search unavailable: ${message}`);
    return [];
  });

  return {
    items: rankCatalogItems(items, query),
    warnings,
  };
}

export async function getFazerCardsCatalogDetails(
  kind: FazerCardsCatalogKind,
  categoryId: string,
  displayName?: string,
): Promise<FazerCardsCatalogDetails> {
  if (kind === "gift_card") {
    return getFazerCardsGiftCardDetails(categoryId);
  }

  if (kind === "steam_gift") {
    return getFazerCardsSteamGiftDetails(categoryId, displayName);
  }

  return getFazerCardsTopupDetails(categoryId);
}

export async function getFazerCardsTopupDetails(categoryId: string): Promise<FazerCardsCatalogDetails> {
  const params = new URLSearchParams({ category_id: categoryId, include_ui: "1" });
  const body = await fazerCardsFetch<{
    category_id: string;
    name: string;
    note?: string;
    imageurl?: string;
    fields?: FazerCardsField[];
    offers?: FazerCardsTopupOffer[];
  }>(`/topups/offers?${params.toString()}`);

  return {
    kind: "topup",
    categoryId: body.category_id,
    name: body.name,
    note: body.note ?? null,
    imageUrl: body.imageurl ?? null,
    fields: mapFields(body.fields ?? []),
    offers: (body.offers ?? []).map((offer) => ({
      offerId: offer.offer_id ?? offer.name,
      name: offer.name,
      priceUsd: Number(offer.price_usd),
    })),
  };
}

async function getFazerCardsGiftCardDetails(categoryId: string): Promise<FazerCardsCatalogDetails> {
  const params = new URLSearchParams({ category_id: categoryId, include_ui: "1" });
  const body = await fazerCardsFetch<{
    category_id: string;
    name: string;
    note?: string;
    imageurl?: string | null;
    offers?: Array<{
      card_id?: string | null;
      name: string;
      price_usd: string;
      stock?: number;
      min_order_quantity?: number;
      max_order_quantity?: number;
    }>;
  }>(`/giftcards/cards?${params.toString()}`);

  return {
    kind: "gift_card",
    categoryId: body.category_id,
    name: body.name,
    note: body.note ?? null,
    imageUrl: body.imageurl ?? null,
    fields: [],
    offers: (body.offers ?? []).map((offer) => ({
      offerId: offer.card_id ?? offer.name,
      name: offer.name,
      priceUsd: Number(offer.price_usd),
      stock: offer.stock,
      minOrderQuantity: offer.min_order_quantity,
      maxOrderQuantity: offer.max_order_quantity,
    })),
  };
}

async function getFazerCardsSteamGiftDetails(
  appId: string,
  displayName?: string,
): Promise<FazerCardsCatalogDetails> {
  const details = await fazerCardsFetch<{
    appid: number;
    offers?: Array<{
      sub_id: number;
      name: string;
      regions: Array<{ region: string; price: string }>;
    }>;
  }>(`/steam-gifts/games/${encodeURIComponent(appId)}`);
  const gameName = displayName || `Steam app ${details.appid}`;

  return {
    kind: "steam_gift",
    categoryId: String(details.appid),
    name: gameName,
    note: "Steam gift game. Customer must provide a valid Steam invite URL during checkout.",
    imageUrl: null,
    fields: [
      {
        key: "steam_invite_url",
        label: "Steam invite URL",
        placeholder: "Paste the customer's Steam invite URL",
        type: "text",
      },
    ],
    offers: (details.offers ?? []).flatMap((offer) =>
      offer.regions.map((region) => ({
        offerId: `${offer.sub_id}:${region.region}`,
        name: `${offer.name} (${region.region})`,
        priceUsd: Number(region.price),
        region: region.region,
      })),
    ),
  };
}

function mapFields(fields: FazerCardsField[]): RequiredField[] {
  return fields.map((field) => ({
    key: field.key,
    label: field.label,
    placeholder: field.label,
    type: field.type === "number" ? "number" : field.type === "select" ? "select" : "text",
    options: Array.isArray(field.options)
      ? field.options
          .map((option) => {
            if (typeof option === "string") {
              return option;
            }
            return option.value ?? option.label ?? option.name ?? "";
          })
          .filter(Boolean)
      : undefined,
  }));
}

function rankCatalogItems(items: FazerCardsCatalogItem[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return items.slice(0, 80);
  }

  return items
    .map((item) => ({ ...item, score: scoreCatalogItem(item, normalized) }))
    .filter((item) => (item.score ?? 0) > 0)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.name.localeCompare(b.name))
    .slice(0, 80);
}

function scoreCatalogItem(item: FazerCardsCatalogItem, query: string) {
  const haystack = `${item.name} ${item.id} ${item.note ?? ""}`.toLowerCase();
  const name = item.name.toLowerCase();
  const id = item.id.toLowerCase();
  const tokens = query.split(/\s+/).filter(Boolean);

  let score = 0;
  if (name === query || id === query) score += 1000;
  if (name.startsWith(query) || id.startsWith(query)) score += 450;
  if (name.includes(query) || id.includes(query)) score += 300;

  for (const token of tokens) {
    if (name.includes(token)) score += 80;
    if (id.includes(token)) score += 60;
    if (haystack.includes(token)) score += 20;
  }

  if (tokens.length > 1 && tokens.every((token) => haystack.includes(token))) {
    score += 180;
  }

  return score;
}
