import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(path, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, require(name) {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  } });
  return exports;
}
const { moveVariation } = load("../src/lib/variation-order.ts");
const original = [{ localId: "a", id: "a", priceMyr: 3 }, { localId: "b", id: "b", priceMyr: 1 }, { localId: "c", id: "c", priceMyr: 2 }];
const moved = moveVariation(original, "a", "c");
assert.equal(moved.map((v) => v.id).join(), "b,c,a");
assert.equal(original.map((v) => v.id).join(), "a,b,c");
assert.equal(moveVariation(moved, "a", "b").map((v) => v.id).join(), "a,b,c");
assert.equal(moveVariation(original, "missing", "a"), original);
assert.equal(moveVariation(original, "a", "a"), original);
const writes = [];
const ordering = [];
const db = { from(table) {
  let patch;
  const filters = {};
  const query = {
    select() { return query; }, eq(key, value) { filters[key] = value; return query; },
    update(value) { patch = value; return query; },
    order(key, options) { ordering.push({ key, ...options }); return query; },
    maybeSingle: async () => ({ data: null, error: null }),
    then(resolve) { if (patch) writes.push({ table, patch, filters }); return Promise.resolve({ data: [], error: null }).then(resolve); },
  };
  return query;
} };
const products = load("../src/lib/products.ts", {
  "./supplier-credit": {}, "./funding-cost": { getFundingCostBasis: async () => null },
  "./cost-conversion": {}, "./stock": {}, "./integrations/fazercards-pricing": {},
  "./integrations/fazercards-catalog": {}, "./supabase/admin": { createSupabaseAdminClient: () => db },
  "./validation": { adminProductUpdateSchema: { parse: (input) => input } },
});
await products.updateAdminProduct("product", { variations: moved });
const saved = writes.filter((w) => w.table === "product_variations");
assert.equal(saved.map((w) => w.filters.id).join(), "b,c,a");
assert.equal(saved.map((w) => w.patch.sort_order).join(), "0,1,2");
assert.equal(saved.map((w) => w.patch.price_myr).join(), "1,2,3");
assert.ok(saved.every((w) => w.filters.product_id === "product"));
await products.getAdminProducts();
await products.getStoreProductBySlug("mlbb");
assert.equal(ordering.filter((o) => o.key === "sort_order" && o.referencedTable === "product_variations" && o.ascending).length, 2);
console.log("PASS: Reordering preserves items/prices, persists positions scoped to product, and admin/detail reads request saved order.");
