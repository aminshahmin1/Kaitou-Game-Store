import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../src/lib/checkout-product.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports });
const product = { slug: "mlbb", title: "Mobile Legends", fazercardsProductId: "supplier-category",
  requiredFields: [{ key: "player_id", label: "Player ID", placeholder: "ID", type: "number" }],
  variations: [{ id: "v1", title: "13 + 1", priceMyr: 1.1, active: true, available: true,
    costUsd: 0.2317, costMyr: 1, sku: "private-sku", fazercardsSku: "private-provider-sku" }],
};
const checkout = exports.toCheckoutProduct(product);
assert.equal(checkout.variations[0].priceMyr, 1.1);
assert.equal(checkout.requiredFields[0].key, "player_id");
const serialized = JSON.stringify(checkout);
for (const privateField of ["fazercardsProductId", "costUsd", "costMyr", "sku", "fazercardsSku", "private-provider-sku"]) {
  assert.ok(!serialized.includes(privateField), privateField);
}
for (const page of ["src/app/products/[slug]/page.tsx", "src/app/dashboard/launch-test/page.tsx"]) {
  assert.match(readFileSync(new URL(`../${page}`, import.meta.url), "utf8"), /product=\{toCheckoutProduct\(product\)\}/);
}
console.log("PASS: Checkout receives only buyer-facing fields; costs and supplier mappings stay server-side.");
