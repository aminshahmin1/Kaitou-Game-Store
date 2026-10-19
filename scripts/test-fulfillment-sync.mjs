import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const rows = Array.from({ length: 4 }, (_, index) => ({
  id: String(index), fulfillment_reference: `ord-${index}`, status: "processing",
  paid_at: "2026-10-01T00:00:00Z", updated_at: `2026-10-01T00:00:0${index}Z`,
}));
rows.push({ ...rows[0], id: "unpaid", fulfillment_reference: "ord-unpaid", paid_at: null });
const checked = [];
let lookup = async (reference) => {
  checked.push(reference);
  if (reference !== "ord-3") throw new Error("Temporary outage");
  return { status: "completed", providerReference: reference, raw: { ok: true } };
};
const db = { from() {
  const filters = [];
  let patch;
  let limit = Infinity;
  let sort;
  const query = {
    select() { return query; },
    eq(key, value) { filters.push((row) => row[key] === value); return query; },
    not(key, _operator, value) { filters.push((row) => row[key] !== value); return query; },
    like(key, pattern) { filters.push((row) => row[key]?.startsWith(pattern.replace("%", ""))); return query; },
    order(key) { sort = key; return query; },
    limit(value) { limit = value; return query; },
    update(value) { patch = value; return query; },
    then(resolve) {
      let matches = rows.filter((row) => filters.every((filter) => filter(row)));
      if (sort) matches = matches.sort((a, b) => a[sort].localeCompare(b[sort]));
      matches = matches.slice(0, limit);
      if (patch) matches.forEach((row) => Object.assign(row, patch));
      return Promise.resolve({ data: structuredClone(matches), error: null }).then(resolve);
    },
  };
  return query;
} };
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../src/lib/fulfillment-sync.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports, require(name) {
  if (name === "server-only") return {};
  if (name === "./supabase/admin") return { createSupabaseAdminClient: () => db };
  if (name === "./revenue") return { allocateFundingForOrder: async () => ({ allocatedOrders: 1 }) };
  if (name === "./integrations/fazercards") return { getFazerCardsOrder: (reference) => lookup(reference) };
  throw new Error(`Unexpected import: ${name}`);
} });
const first = await exports.reconcileProviderOrders();
assert.equal(first.failed, 3);
assert.equal(first.updated, 0);
assert.ok(rows.slice(0, 3).every((row) => row.status === "processing"));
const second = await exports.reconcileProviderOrders();
assert.equal(second.updated, 1);
assert.equal(checked[3], "ord-3");
assert.equal(rows[3].status, "completed");
assert.ok(!checked.includes("ord-unpaid"));

// An administrator resolving an order during the request must not be overwritten.
rows.splice(0, rows.length, { id: "race", fulfillment_reference: "ord-race", status: "processing", paid_at: "2026-10-01", updated_at: "2026-10-01" });
lookup = async () => {
  rows[0].status = "refunded";
  return { status: "completed", providerReference: "ord-race", raw: {} };
};
assert.equal((await exports.reconcileProviderOrders()).updated, 0);
assert.equal(rows[0].status, "refunded");
rows[0].status = "processing";
lookup = async () => {
  rows[0].status = "review";
  rows[0].updated_at = "admin-change";
  throw new Error("Lookup failed");
};
await exports.reconcileProviderOrders();
assert.equal(rows[0].status, "review");
assert.equal(rows[0].updated_at, "admin-change");

// First confirmed debit is immutable, including after profit allocation.
for (const locked of [false, true]) {
  rows.splice(0, rows.length, {
    id: "cost", fulfillment_reference: "ord-cost", status: "processing",
    paid_at: "2026-10-01", updated_at: "2026-10-01", cost_usd: 0.2317,
    supplier_cost_confirmed_at: locked ? "2026-10-01" : null,
    profit_allocated_at: locked ? "2026-10-01" : null,
  });
  lookup = async () => ({ status: "completed", providerReference: "ord-cost", chargedUsd: 0.25, raw: {} });
  assert.equal((await exports.reconcileProviderOrders()).updated, 1);
  assert.equal(rows[0].cost_usd, locked ? 0.2317 : 0.25);
  assert.equal(rows[0].status, locked ? "review" : "completed");
  if (locked) assert.equal(rows[0].supplier_cost_confirmed_at, "2026-10-01");
  else assert.ok(rows[0].supplier_cost_confirmed_at);
}

rows[0].status = "processing";
lookup = async () => ({ status: "completed", providerReference: "ord-cost", chargedUsd: 0.2317, raw: {} });
await exports.reconcileProviderOrders();
assert.equal(rows[0].status, "completed");
assert.equal(rows[0].supplier_cost_confirmed_at, "2026-10-01");

const route = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../src/app/api/webhooks/fazercards/route.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: route, require: () => ({ NextResponse: Response }) });
const disabled = await route.POST();
assert.equal(disabled.status, 503);
assert.equal((await disabled.json()).received, false);
console.log("PASS: Failed polls rotate, later orders complete, unpaid orders excluded, concurrent admin changes preserved, disabled webhook never acknowledges processing.");
