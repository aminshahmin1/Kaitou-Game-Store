import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const filters = [];
let rpcCalls = 0;
let fail = false;
const query = {
  select() { return query; },
  in(...args) { filters.push(args); return query; },
  not(...args) { filters.push(args); return query; },
  is(...args) { filters.push(args); return query; },
  eq(...args) { filters.push(args); return query; },
  filter(...args) { filters.push(args); return query; },
  limit(...args) { filters.push(["limit", ...args]); return query; },
  order() { return query; },
  then(resolve) { return Promise.resolve({ data: [{ id: "one", order_number: "KGS-ONE" }], error: null }).then(resolve); },
};
const db = {
  from(table) { assert.equal(table, "orders"); return query; },
  async rpc(name, args) {
    assert.equal(name, "allocate_order_funding");
    assert.equal(args.p_order_id, "one");
    rpcCalls++;
    return fail ? { data: null, error: { message: "Internal database details" } }
      : { data: { allocated: rpcCalls === 1, reason: "Order already allocated." }, error: null };
  },
};
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../src/lib/revenue.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports, require(name) {
  if (name === "server-only" || name === "./revenue-dates") return {};
  if (name === "./supabase/admin") return { createSupabaseAdminClient: () => db };
  throw new Error(`Unexpected import ${name}`);
} });
assert.equal((await exports.allocateFundingForOrder("one")).allocatedOrders, 1);
assert.ok(filters.some((f) => f[0] === "paid_at" && f[1] === "is" && f[2] === null));
assert.ok(filters.some((f) => f[0] === "supplier_cost_confirmed_at"));
assert.ok(filters.some((f) => f[0] === "id" && f[1] === "one"));
const repeated = await exports.allocateFundingForOrder("one");
assert.equal(repeated.allocatedOrders, 0);
assert.equal(repeated.skippedOrders[0].reason, "Order already allocated.");
await exports.allocatePaidOrdersFunding({ manualOnly: true, limit: 25 });
assert.ok(filters.some((f) => f[0] === "cost_exchange_rate" && f[1] === "not.is"));
assert.ok(filters.some((f) => f[0] === "limit" && f[1] === 25));
fail = true;
await assert.rejects(exports.allocateFundingForOrder("one"), /No partial allocation/);
console.log("PASS: Allocation delegates to server transaction, filters verified orders, reports duplicates and handles RPC failure.");
