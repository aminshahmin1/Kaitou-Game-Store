import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const exports = {};
vm.runInNewContext(ts.transpileModule(read("src/lib/validation.ts"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
  { exports, URL, require });
const product = { title: "Game", slug: "game", type: "topup", category: "Game Top-Ups", game: "Game", imageTone: "fallback",
  region: "MY", deliveryType: "Direct top-up", variations: [{ title: "Currency", sku: "one", priceMyr: 2 }] };
assert.equal(exports.adminProductCreateSchema.parse({ ...product, imageUrl: "https://example.com/poster.jpg" }).imageUrl, "https://example.com/poster.jpg");
for (const imageUrl of ["javascript:alert(1)", "http://example.com/a.png", "https://user:secret@example.com/a.png", "data:image/svg+xml,test"]) {
  assert.equal(exports.adminProductCreateSchema.safeParse({ ...product, imageUrl }).success, false);
}
const queries = read("src/lib/products.ts");
assert.equal(queries.match(/required_fields, image_url, leaderboard_unit/g)?.length, 3);
assert.equal(queries.match(/image_url: parsed.imageUrl \|\| null/g)?.length, 2);
assert.ok(queries.includes("imageUrl: row.image_url ?? null"));
const checkout = read("src/components/checkout-form.tsx");
assert.match(checkout, /<div data-dark-surface className="shrink-0/);
assert.match(checkout, /<button\s+data-dark-surface/);
assert.ok(!/a\s*\{\s*color:\s*inherit/.test(read("src/app/globals.css")));
console.log("PASS: HTTPS-only artwork, read/write/import mapping, contrast-protected checkout badge and payment button, no anchor colour override.");
