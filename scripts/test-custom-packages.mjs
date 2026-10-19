import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(file, deps = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, require(name) { if (name === "server-only") return {}; return name in deps ? deps[name] : require(name); } });
  return exports;
}
const packages = load("src/lib/custom-packages.ts");
const base = { title: "8100 UC", fazercardsSku: "pubg:8100", costUsd: 80, costMyr: 350, repeatable: true };
const custom = { ...base, title: "16200 UC", supplierQuantity: 2, costUsd: 0, priceMyr: 800 };
const normalized = packages.normalizeCustomPackages("topup", [base, custom]);
assert.equal(normalized[1].costUsd, 160);
assert.equal(normalized[1].priceMyr, 800);
assert.equal(normalized[1].basePackageTitle, "8100 UC");
assert.throws(() => packages.normalizeCustomPackages("steam_gift_game", [base, custom]));
assert.throws(() => packages.normalizeCustomPackages("topup", [{ ...base, repeatable: false }, custom]));
assert.equal(packages.normalizeCustomPackages("topup", [{ ...base, title: "Weekly Pass" }, custom])[1].currencyUnits, 0);
assert.throws(() => packages.normalizeCustomPackages("topup", [{ ...base, title: "First purchase pack" }, custom]));
for (const supplierQuantity of [0, 1.5, 6, NaN]) assert.throws(() => packages.normalizeCustomPackages("topup", [base, { ...custom, supplierQuantity }]));
const { fulfillCustomPackage } = load("src/lib/integrations/fazercards-bundles.ts");
const input = { orderId: "KGS-UNIT", product: { type: "topup" }, variation: { sku: "custom", fazercardsSku: "pubg:8100", supplierQuantity: 2 }, fieldValues: { player_id: "00123" } };
let calls = [], failSecond = true;
const create = async (order) => {
  calls.push(order.orderId);
  assert.equal(order.fieldValues.player_id, "00123");
  assert.equal(order.variation.supplierQuantity, 1);
  if (order.orderId.endsWith(":2") && failSecond) throw Error("Network timeout");
  return { providerReference: `ord-${order.orderId.endsWith(":1") ? 1 : 2}`, status: "completed", chargedUsd: 80, message: "Completed" };
};
let result = await fulfillCustomPackage(input, create, async () => { throw Error("Unexpected lookup"); });
assert.equal(result.status, "review");
assert.equal(result.raw.children[0].status, "completed");
assert.equal(result.chargedUsd, undefined);
failSecond = false;
result = await fulfillCustomPackage({ ...input, previous: result.raw }, create, async () => { throw Error("Unexpected lookup"); });
assert.equal(result.status, "completed");
assert.equal(result.chargedUsd, 160);
assert.deepEqual(calls, ["KGS-UNIT:part:1", "KGS-UNIT:part:2", "KGS-UNIT:part:2"]);
await fulfillCustomPackage({ ...input, previous: result.raw }, async () => { throw Error("Completed part replayed"); }, async () => { throw Error("Completed lookup"); });
await assert.rejects(fulfillCustomPackage({ ...input, previous: { ...result.raw, orderId: "OTHER" } }, create, create));
let created = 0, lookedUp = 0;
const slowCreate = async () => ({ providerReference: `ord-${++created}`, status: "processing", chargedUsd: 0.1, message: "Accepted" });
const get = async (ref) => { lookedUp++; return { providerReference: ref, status: "completed", chargedUsd: 0.1, message: "Completed" }; };
const five = { ...input, variation: { ...input.variation, supplierQuantity: 5 } };
let progress;
for (let i = 0; i < 3; i++) {
  result = await fulfillCustomPackage({ ...five, previous: progress }, slowCreate, get); progress = result.raw;
  assert.equal(result.status, "processing");
}
assert.equal(created, 5);
assert.equal(lookedUp, 0);
assert.equal(result.chargedUsd, 0.5);
result = await fulfillCustomPackage({ ...five, previous: progress }, slowCreate, get);
assert.equal(result.status, "completed");
assert.equal(lookedUp, 5);
const missingCost = await fulfillCustomPackage(input, async (i) => ({ providerReference: i.orderId.endsWith(":1") ? "ord-1" : "ord-2", status: "completed", message: "Complete" }), get);
assert.equal(missingCost.status, "processing");
assert.equal((await fulfillCustomPackage({ ...input, previous: missingCost.raw }, slowCreate, get)).chargedUsd, 0.2);
const conflict = await fulfillCustomPackage({ ...five, previous: progress }, slowCreate, async (ref) => ({ providerReference: ref, status: "completed", chargedUsd: 0.2, message: "Changed" }));
assert.equal(conflict.status, "review");
assert.equal(conflict.chargedUsd, undefined);
const three = { ...input, variation: { ...input.variation, supplierQuantity: 3 } };
const threeCalls = [];
const deliverThree = async (part) => { threeCalls.push({ key: part.orderId, fields: part.fieldValues }); return { providerReference: `ord-${threeCalls.length}`, status: "completed", chargedUsd: 1, message: "Completed" }; };
let threeResult = await fulfillCustomPackage(three, deliverThree, get);
assert.equal(threeResult.status, "processing");
threeResult = await fulfillCustomPackage({ ...three, previous: threeResult.raw }, deliverThree, get);
assert.equal(threeResult.status, "completed"); assert.equal(threeResult.chargedUsd, 3);
assert.deepEqual(threeCalls.map((part) => part.key), ["KGS-UNIT:part:1", "KGS-UNIT:part:2", "KGS-UNIT:part:3"]);
assert.ok(threeCalls.every((part) => part.fields === input.fieldValues));
let stock = null;
const pricing = load("src/lib/integrations/fazercards-pricing.ts", {
  "../custom-packages": packages,
  "./fazercards-catalog": { getFazerCardsCatalogDetails: async () => ({ categoryId: "pubg", offers: [{ offerId: "8100", priceUsd: 90, stock }] }) },
});
const product = { type: "topup", available: true, fazercardsProductId: "pubg", variations: [{ ...custom, available: true, basePackageTitle: "8100 UC" }] };
let fresh = (await pricing.refreshSupplierPrices([product]))[0].variations[0];
assert.equal(fresh.costUsd, 180);
assert.equal(fresh.priceMyr, 800);
stock = 1;
assert.equal((await pricing.refreshSupplierPrices([product]))[0].variations[0].available, false);
console.log("PASS: Custom package approval, limits, combined pricing, immutable part keys, partial failure/retry, no repeat deliveries, bounded execution, missing costs and stock quantities.");
