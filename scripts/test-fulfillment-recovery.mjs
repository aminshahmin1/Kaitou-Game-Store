import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { timingSafeEqual } from "node:crypto";

let row;
let purchases;
let onPurchase;
let allocationCount;
let failSave;
function reset(patch = {}) {
  row = { id: "one", order_number: "KGS-ORIGINAL", status: "processing", paid_at: "2026-10-01",
    updated_at: "2026-10-01", fulfillment_reference: null, customer_fields: { user_id: "00123" },
    fulfillment_snapshot: { product: { type: "topup" }, variation: { fazercardsSku: "original:sku" } }, ...patch };
  purchases = [];
  allocationCount = 0;
  failSave = false;
  onPurchase = async () => ({ status: "completed", providerReference: "ord-123", chargedUsd: 0.2, raw: {} });
}
const db = { from() {
  const filters = [];
  let patch;
  const query = {
    select() { return query; }, order() { return query; }, limit() { return query; },
    eq(key, value) { filters.push((r) => r[key] === value); return query; },
    is(key, value) { filters.push((r) => r[key] === value); return query; },
    not(key, _op, value) { filters.push((r) => r[key] !== value); return query; },
    lt(key, value) { filters.push((r) => r[key] < value); return query; },
    update(value) { patch = value; return query; },
    async maybeSingle() {
      if (patch?.fulfillment_reference && failSave) return { data: null, error: { message: "Save failed" } };
      const matches = row && filters.every((f) => f(row));
      if (matches && patch) Object.assign(row, patch, { updated_at: new Date().toISOString() });
      return { data: matches ? structuredClone(row) : null, error: null };
    },
  };
  return query;
} };
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../src/lib/fulfillment-recovery.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports, require(name) {
  if (name === "server-only") return {};
  if (name === "./supabase/admin") return { createSupabaseAdminClient: () => db };
  if (name === "./fulfillment-snapshot") return { readFulfillmentSnapshot: (value) => { if (!value) throw new Error("Missing mapping"); return value; } };
  if (name === "./integrations/fazercards") return { createFazerCardsOrder: async (input) => { purchases.push(input); return onPurchase(); } };
  if (name === "./revenue") return { allocateFundingForOrder: async () => { allocationCount++; } };
  throw new Error(`Unexpected import ${name}`);
} });
reset();
assert.equal((await exports.recoverInterruptedFulfillment()).recovered, 1);
assert.equal(purchases[0].orderId, "KGS-ORIGINAL");
assert.equal(purchases[0].variation.fazercardsSku, "original:sku");
assert.equal(purchases[0].fieldValues.user_id, "00123");
assert.equal(row.fulfillment_reference, "ord-123");
assert.equal(allocationCount, 1);
await exports.recoverInterruptedFulfillment();
assert.equal(purchases.length, 1);
for (const patch of [{ paid_at: null }, { updated_at: new Date().toISOString() }, { status: "refunded" }, { fulfillment_reference: "ord-existing" }]) {
  reset(patch);
  await exports.recoverInterruptedFulfillment();
  assert.equal(purchases.length, 0);
}
reset({ fulfillment_snapshot: null });
assert.equal((await exports.recoverInterruptedFulfillment()).review, 1);
assert.equal(purchases.length, 0);
reset();
onPurchase = async () => { row.status = "review"; row.updated_at = "admin-update"; return { status: "completed", providerReference: "ord-123" }; };
assert.equal((await exports.recoverInterruptedFulfillment()).recovered, 0);
assert.equal(row.status, "review");
reset();
failSave = true;
await assert.rejects(exports.recoverInterruptedFulfillment(), /Could not save recovered/);
assert.equal(row.status, "processing");
assert.equal(row.fulfillment_reference, null);
reset({ cost_usd: 1, supplier_cost_confirmed_at: "2026-10-01" });
assert.equal((await exports.recoverInterruptedFulfillment()).review, 1);
assert.equal(row.cost_usd, 1);
assert.equal(allocationCount, 0);
console.log("PASS: Stale paid recovery, original key/mapping, duplicate avoidance, unpaid/fresh exclusion, admin races, failed save retry and cost conflicts.");

const route = {};
let workerCalls = 0;
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../src/app/api/cron/fulfillment/route.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: route, Buffer, process: { env: { BALANCE_MONITOR_SECRET: "isolated-test-secret" } }, require(name) {
  if (name === "node:crypto") return { timingSafeEqual };
  if (name === "next/server") return { NextResponse: Response };
  if (name === "@/lib/fulfillment-recovery") return { recoverInterruptedFulfillment: async () => { workerCalls++; return { recovered: 0 }; } };
  if (name === "@/lib/fulfillment-sync") return { reconcileProviderOrders: async () => ({ updated: 0, failed: 0 }) };
  throw new Error(`Unexpected route dependency ${name}`);
} });
assert.equal((await route.POST(new Request("https://example.invalid"))).status, 401);
assert.equal(workerCalls, 0);
assert.equal((await route.POST(new Request("https://example.invalid", { headers: { authorization: "Bearer isolated-test-secret" } }))).status, 200);
assert.equal(workerCalls, 1);
console.log("PASS: Recovery worker rejects unauthenticated requests before doing any work.");
