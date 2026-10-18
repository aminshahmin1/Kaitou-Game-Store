import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { timingSafeEqual } from "node:crypto";
let row, result, purchaseCount, allocations, failSave, duringPurchase;
function reset() {
  row = { id: "one", order_number: "KGS-ONE", status: "processing", fulfillment_reference: "bundle-KGS-ONE",
    bundle_lease_until: "lease", fulfillment_snapshot: { product: { type: "topup" }, variation: { supplierQuantity: 2 } },
    fulfillment_raw: { kind: "bundle", children: [] }, customer_fields: { player_id: "00123" }, cost_usd: 0.4 };
  result = { status: "completed", chargedUsd: 0.4, raw: { kind: "bundle", children: [{ index: 1 }] } };
  purchaseCount = 0; allocations = 0; failSave = false; duringPurchase = () => {};
}
const db = { rpc: async () => ({ data: row ? [structuredClone(row)] : [], error: null }), from() {
  let patch; const filters = [];
  const q = { update(value) { patch = value; return q; }, select() { return q; },
    eq(key, value) { filters.push((r) => r[key] === value); return q; },
    async maybeSingle() {
      if (failSave) return { data: null, error: { message: "DB unavailable" } };
      if (!row || !filters.every((f) => f(row))) return { data: null, error: null };
      Object.assign(row, patch); return { data: { id: row.id }, error: null };
    } };
  return q;
} };
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../src/lib/bundle-fulfillment.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports, require(name) {
  if (name === "server-only") return {};
  if (name === "./supabase/admin") return { createSupabaseAdminClient: () => db };
  if (name === "./fulfillment-snapshot") return { readFulfillmentSnapshot: (value) => value };
  if (name === "./supplier-credit") return { hasSupplierReservation: async () => true };
  if (name === "./revenue") return { allocateFundingForOrder: async () => { allocations++; } };
  if (name === "./integrations/fazercards") return { createFazerCardsOrder: async (input) => {
    purchaseCount++; assert.equal(input.orderId, "KGS-ONE"); assert.equal(input.fieldValues.player_id, "00123");
    assert.equal(input.previous.kind, "bundle"); duringPurchase(); return result;
  } };
  throw Error(name);
} });
reset(); assert.equal((await exports.reconcileNextBundle()).updated, 1);
assert.equal(row.status, "completed"); assert.equal(row.bundle_lease_until, null); assert.equal(allocations, 1);
reset(); duringPurchase = () => { row.status = "refunded"; };
assert.equal((await exports.reconcileNextBundle()).updated, 0); assert.equal(row.status, "refunded"); assert.equal(allocations, 0);
reset(); row.supplier_cost_confirmed_at = "prior"; result.chargedUsd = 0.5;
await exports.reconcileNextBundle(); assert.equal(row.status, "review"); assert.equal(row.cost_usd, 0.4); assert.equal(allocations, 0);
reset(); failSave = true;
await assert.rejects(exports.reconcileNextBundle(), /could not be saved/); assert.equal(row.status, "processing"); assert.equal(row.bundle_lease_until, "lease");
reset(); row.fulfillment_snapshot.variation.supplierQuantity = 1;
await exports.reconcileNextBundle(); assert.equal(purchaseCount, 0); assert.equal(row.status, "review");
reset(); row = null; assert.equal((await exports.reconcileNextBundle()).updated, 0);
console.log("PASS: Bundle worker identity, original history, confirmed costs, stale-admin protection, failed-save recovery and empty queue.");
const route = {}, env = {};
let workerCalls = 0, workerFails = false;
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../src/app/api/cron/bundles/route.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: route, Buffer, process: { env }, require(name) {
  if (name === "node:crypto") return { timingSafeEqual };
  if (name === "next/server") return { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } };
  if (name === "@/lib/bundle-fulfillment") return { reconcileNextBundle: async () => {
    workerCalls++; if (workerFails) throw Error("Private provider details"); return { updated: 0 };
  } };
  throw Error(name);
} });
const request = (authorization) => ({ headers: new Headers(authorization ? { authorization } : {}) });
assert.equal((await route.POST(request())).status, 401);
env.BALANCE_MONITOR_SECRET = "test-worker-secret";
assert.equal((await route.POST(request("Bearer wrong"))).status, 401);
assert.equal(workerCalls, 0);
assert.equal((await route.POST(request("Bearer test-worker-secret"))).status, 200);
workerFails = true;
const failed = await route.POST(request("Bearer test-worker-secret"));
assert.equal(failed.status, 503); assert.ok(!JSON.stringify(failed.body).includes("Private provider"));
console.log("PASS: Bundle worker authentication fails closed and sanitizes failures.");
