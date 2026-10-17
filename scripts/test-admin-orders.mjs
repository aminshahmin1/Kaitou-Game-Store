import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

let row;
let race = false;
let writes = 0;
const reset = (patch = {}) => {
  row = { id: "order", status: "review", paid_at: "2026-10-17", updated_at: "original", refund_reference: null, support_notes: null, ...patch };
  race = false;
  writes = 0;
};
const db = { from() {
  let patch;
  const filters = [];
  const query = {
    select() { return query; },
    eq(key, value) { filters.push((item) => item[key] === value); return query; },
    update(value) { patch = value; return query; },
    async maybeSingle() {
      if (patch && race) row.updated_at = "newer-change";
      const found = row && filters.every((filter) => filter(row));
      if (found && patch) { writes++; Object.assign(row, patch); }
      return { data: found ? structuredClone(row) : null, error: null };
    },
  };
  return query;
} };
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../src/lib/admin-orders.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports, require(name) {
  if (name === "server-only") return {};
  if (name === "./supabase/admin") return { createSupabaseAdminClient: () => db };
  throw new Error(`Unexpected dependency ${name}`);
} });
const update = (input) => exports.updateAdminOrder("order", input);
reset({ paid_at: null });
await assert.rejects(update({ status: "completed", supportNotes: "Delivered" }), /Payment must be verified/);
assert.equal(writes, 0);
await update({ supportNotes: "Customer asked about payment" });
assert.equal(row.status, "review");
reset();
await assert.rejects(update({ status: "completed" }), /confirming delivery/);
await update({ status: "completed", supportNotes: "Manual delivery verified" });
assert.equal(row.status, "completed");
reset({ support_notes: "Earlier delivery note" });
await assert.rejects(update({ status: "completed", supportNotes: " " }), /confirming delivery/);
reset();
await assert.rejects(update({ status: "refunded" }), /refund first/);
await update({ status: "refunded", refundReference: "BANK-123" });
assert.equal(row.status, "refunded");
await assert.rejects(update({ status: "processing" }), /cannot be reopened/);
await assert.rejects(update({ refundReference: "  " }), /refund first/);
reset();
race = true;
await assert.rejects(update({ supportNotes: "Stale note" }), /changed while/);
assert.equal(writes, 0);
assert.equal(row.support_notes, null);
row = null;
await assert.rejects(update({ status: "review" }), /not found/);
console.log("PASS: Paid-only status changes, delivery notes, refund evidence, terminal refund state, missing orders and concurrent updates.");
