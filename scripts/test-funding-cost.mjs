import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const source = ts.transpileModule(readFileSync(new URL("../src/lib/funding-cost.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
async function run(batches, config, error = null) {
  const exports = {};
  const db = { from(table) {
    const result = table === "funding_batches" ? { data: batches, error } : { data: config ? { public_config: config } : null, error: null };
    const query = { select() { return query; }, eq() { return query; }, order() { return query; }, maybeSingle() { return Promise.resolve(result); }, then(resolve) { return Promise.resolve(result).then(resolve); } };
    return query;
  } };
  vm.runInNewContext(source, { exports, require(name) {
    if (name === "server-only") return {};
    if (name === "./supabase/admin") return { createSupabaseAdminClient: () => db };
    throw new Error(`Unexpected import ${name}`);
  } });
  return exports.getFundingCostBasis();
}
assert.equal((await run([], { totalMyr: 57.93, creditedUsd: 14 })).rate, 57.93 / 14);
assert.equal(await run([], null), null);
assert.equal(await run([], { totalMyr: 10, creditedUsd: 0 }), null);
assert.equal((await run([{ effective_rate: 4.2, usd_credited: 10, order_funding_allocations: [{ amount_usd: 3 }] }], null)).rate, 4.2);
assert.equal(await run([{ effective_rate: 4.2, usd_credited: 10, order_funding_allocations: [{ amount_usd: 10 }] }], { totalMyr: 57.93, creditedUsd: 14 }), null);
await assert.rejects(() => run([], null, { message: "database down" }));
console.log("PASS: Opening estimate, missing basis, remaining funding and exhausted ledger without stale fallback.");
