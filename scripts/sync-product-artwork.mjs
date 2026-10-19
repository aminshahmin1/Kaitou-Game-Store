import { createClient } from "@supabase/supabase-js";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const { data: products, error } = await db.from("products").select("id,title,type,fazercards_product_id,image_url");
if (error) throw Error("Product artwork lookup failed");
const response = await fetch(`${process.env.FAZERCARDS_API_BASE_URL ?? "https://api.fzr.cards/api/v2"}/topups?limit=500&include_ui=1`, {
  headers: { "X-API-Key": process.env.FAZERCARDS_API_KEY }, signal: AbortSignal.timeout(20000),
});
if (!response.ok) throw Error("Supplier catalogue unavailable");
const catalogue = await response.json();
const images = new Map((catalogue.items ?? []).map((item) => [item.category_id, item.imageurl]));
for (const product of products) {
  if (product.image_url) continue;
  const source = images.get(product.fazercards_product_id)
    ?? (product.type === "steam_gift_game" && /^\d+$/.test(product.fazercards_product_id ?? "")
      ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${product.fazercards_product_id}/header.jpg` : null);
  if (!source?.startsWith("https://")) { console.log(`No artwork: ${product.title}`); continue; }
  const image = await fetch(source, { signal: AbortSignal.timeout(15000) });
  if (!image.ok || !image.headers.get("content-type")?.startsWith("image/")) { console.log(`Artwork unavailable: ${product.title}`); continue; }
  await image.arrayBuffer();
  if (process.argv.includes("--apply")) {
    const { error: saveError } = await db.from("products").update({ image_url: source }).eq("id", product.id)
      .eq("fazercards_product_id", product.fazercards_product_id).is("image_url", null);
    if (saveError) throw Error("Artwork update failed");
  }
  console.log(`${process.argv.includes("--apply") ? "Artwork saved" : "Artwork checked"}: ${product.title}`);
}
