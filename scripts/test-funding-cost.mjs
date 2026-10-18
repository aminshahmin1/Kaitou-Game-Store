import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const source = ts.transpileModule(readFileSync(new URL("../src/lib/funding-cost.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
async function run(rate, error = null) {
  const exports = {};
  const db = { from(table) {
    assert.equal(table, "integration_settings");
    const result = { data: rate === undefined ? null : { public_config: { usdMyr: rate } }, error };
    const query = { select() { return query; }, eq(key, value) {
      assert.equal(key, "id"); assert.equal(value, "supplier-exchange-rate"); return query;
    }, maybeSingle() { return Promise.resolve(result); } };
    return query;
  } };
  vm.runInNewContext(source, { exports, require(name) {
    if (name === "server-only") return {};
    if (name === "./supabase/admin") return { createSupabaseAdminClient: () => db };
    throw new Error(`Unexpected import ${name}`);
  } });
  return exports.getFundingCostBasis();
}
assert.equal((await run(4.08)).rate, 4.08);
assert.equal((await run("4.25")).rate, 4.25);
for (const rate of [undefined, null, "bad", 0, -1, 10001, Infinity]) await assert.rejects(() => run(rate));
await assert.rejects(() => run(4.08, { message: "database down" }));
console.log("PASS: One manual USD/MYR rate, changes reflected without funding-batch dependence, missing/invalid settings fail closed.");
