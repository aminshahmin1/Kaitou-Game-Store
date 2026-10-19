import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../src/lib/checkout-fields.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports, require: createRequire(import.meta.url) });
const validate = exports.validateCheckoutFields;
const fields = [
  { key: "player_id", label: "Player ID", type: "number" },
  { key: "region", label: "Region", type: "select", options: ["MY", "SG"] },
];
const valid = { player_id: " 0012345678901234567890 ", region: "MY" };
assert.equal(validate(fields, valid).values.player_id, "0012345678901234567890");
for (const input of [null, [], {}, { ...valid, player_id: " " }, { ...valid, player_id: "1e5" },
  { ...valid, player_id: "-12" }, { ...valid, player_id: "1.5" }, { ...valid, region: "US" },
  { ...valid, quantity: "999" }, { ...valid, player_id: "1".repeat(1001) }]) {
  assert.equal(validate(fields, input).success, false);
}
assert.equal(validate([fields[0], fields[0]], valid).success, false);
for (const key of ["__proto__", "constructor", "customerName", "bad.key"]) {
  assert.equal(validate([{ key, label: "Invalid" }], {}).success, false);
}
assert.equal(validate([], {}).success, true);
assert.equal(validate([{ key: "invite_url", label: "Steam invite" }], { invite_url: " https://s.team/p/test " }).values.invite_url, "https://s.team/p/test");
console.log("PASS: Trimmed IDs, preserved leading zeroes, strict product fields, valid choices, limits and reserved-key rejection.");

// Exercise the real HTTP handler with isolated storage/payment adapters, never live APIs.
const nativeRequire = createRequire(import.meta.url);
let saved = null;
let billCalls = 0;
const env = { CHECKOUT_ENABLED: "true" };
let adminSession = null;
const variation = { id: "option1", active: true, available: true, priceMyr: 1.10 };
const product = { available: true, requiredFields: fields, variations: [variation] };
const modules = new Map();
function load(relative) {
  if (modules.has(relative)) return modules.get(relative);
  const target = {};
  modules.set(relative, target);
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../${relative}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports: target, console, URL, process: { env }, require(name) {
    if (name === "next/server") return { NextResponse: Response };
    if (name === "@/lib/request-guard") return { guardRequest: async () => null };
    if (name === "@/lib/products") return { getStoreProductBySlug: async () => product };
    if (name === "@/lib/auth/admin-api") return { getAdminApiSession: async () => adminSession };
    if (name === "@/lib/orders") return { createPendingOrder: async (input) => { saved = input; return { expiresAt: new Date(Date.now() + 900000).toISOString() }; }, attachPaymentReference: async () => {} };
    if (name === "@/lib/integrations/toyyibpay") return { createToyyibPayBill: async () => { billCalls++; return { paymentUrl: "https://example.test/bill", providerReference: "mock", paymentSetupRequired: false }; } };
    if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`);
    return nativeRequire(name);
  } });
  return target;
}
const { POST } = load("src/app/api/checkout/route.ts");
const payload = { productSlug: "mobile-legends", variationId: "option1", customerName: "Buyer", customerEmail: "buyer@example.test", whatsapp: "0123456789", fieldValues: valid };
for (const fieldValues of [{ ...valid, price: "0" }, { ...valid, region: "XX" }, { ...valid, player_id: " " }]) {
  const response = await POST(new Request("https://example.test/api/checkout", { method: "POST", body: JSON.stringify({ ...payload, fieldValues }) }));
  assert.equal(response.status, 400);
  assert.equal(saved, null);
  assert.equal(billCalls, 0);
}
const response = await POST(new Request("https://example.test/api/checkout", { method: "POST", body: JSON.stringify(payload) }));
assert.equal(response.status, 200);
assert.equal((await response.json()).pricing.totalMyr, 2.10);
assert.equal(saved.fieldValues.player_id, "0012345678901234567890");
assert.equal(billCalls, 1);
console.log("PASS: Real checkout handler rejects invalid fields before storage/payment and uses normalized valid fields plus RM1 fee.");

product.type = "steam_gift_game";
product.requiredFields = [{ key: "steam_invite_url", label: "Steam invite link" }];
const steamPayload = { ...payload, expectedPriceMyr: 1.10, fieldValues: { steam_invite_url: "https://s.team/p/abc-def/ghijk" } };
const steamRequest = (body) => new Request("https://example.test/api/checkout", { method: "POST", body: JSON.stringify(body) });
saved = null;
assert.equal((await POST(steamRequest({ ...steamPayload, expectedPriceMyr: 1 }))).status, 409);
assert.equal(saved, null); assert.equal(billCalls, 1);
assert.equal((await POST(steamRequest({ ...steamPayload, fieldValues: { steam_invite_url: "https://evil.test/" } }))).status, 400);
assert.equal(saved, null); assert.equal(billCalls, 1);
assert.equal((await POST(steamRequest(steamPayload))).status, 200);
assert.equal(saved.fieldValues.steam_invite_url, "https://s.team/p/abc-def/ghijk");
delete product.type; product.requiredFields = fields;
console.log("PASS: Steam price changes and unsafe invite links rejected before order or payment creation.");
env.CHECKOUT_ENABLED = "false";
assert.equal((await POST(new Request("https://example.test/api/checkout", { method: "POST", body: JSON.stringify(payload) }))).status, 503);
const launchRequest = () => new Request("https://example.test/api/checkout", { method: "POST", headers: { origin: "https://example.test" }, body: JSON.stringify({ ...payload, launchTest: true }) });
assert.equal((await POST(launchRequest())).status, 403);
adminSession = { role: "staff" };
assert.equal((await POST(launchRequest())).status, 403);
adminSession = { role: "owner" };
assert.equal((await POST(launchRequest())).status, 200);
assert.equal(saved.isTest, true);
console.log("PASS: Public checkout remains closed while owner-only launch tests are authenticated and marked separately.");
