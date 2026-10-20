import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const assets = [
  ["genesis-crystal.png", "https://enka.network/ui/UI_ItemIcon_203.png"],
  ["mlbb-diamond.png", "https://liquipedia.net/commons/images/2/2f/Mobile_Legends_Diamond_icon.png"],
  ["lunite.png", "https://s3.ap-southeast-1.amazonaws.com/sg-pay-static-apse1/pay/jolly-admin/prod/app-goods/980%2B110_compressed20250429064414467.png"],
  ["free-fire-diamond.png", "https://www.daddytopup.com/storage/products/01KB7K1S889TJ574S1MB22B5PD.png"],
  ["pubg-uc.png", "https://admin.apeakgaming.com/storage/media/Zb4C3mQ2WKpw1BFJ6HjAGFz3QVrfhfG9Ehznp6j1.png"],
];
await mkdir("public/currencies", { recursive: true });
for (const [filename, url] of assets) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) throw new Error(`Artwork unavailable: ${filename}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 1024 * 1024) throw new Error(`Artwork exceeds budget: ${filename}`);
  await writeFile(path.join("public/currencies", filename), bytes);
  console.log(`${filename}: ${bytes.length} bytes`);
}
