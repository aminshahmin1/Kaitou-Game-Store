import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../src/lib/integrations/fazercards.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports, require: () => ({}), process: { env: {} } });
for (const [supplierStatus, expected] of [["created", "processing"], ["processing", "processing"], ["completed", "completed"], ["failed", "review"], ["refunded", "review"], ["unknown", "review"]]) {
  const result = exports.parseFazerCardsOrder({ ok: true, order: { id: "ord-1", status: supplierStatus } });
  assert.equal(result.status, expected);
  assert.equal(result.providerReference, "ord-1");
}
assert.throws(() => exports.parseFazerCardsOrder({ ok: true, order_id: "wrong-envelope" }));
assert.throws(() => exports.parseFazerCardsOrder({ ok: true, order: { status: "completed" } }));
assert.throws(() => exports.parseFazerCardsOrder({ ok: false, order: { id: "ord-1", status: "completed" } }));
assert.equal(exports.parseFazerCardsOrder({ ok: true, order: { id: "ord-1", status: "completed", total_usd: "0.2317" } }).chargedUsd, 0.2317);
for (const total_usd of [undefined, "NaN", "Infinity", "-1", "0", "1e3", "1.12345"]) {
  assert.equal(exports.parseFazerCardsOrder({ ok: true, order: { id: "ord-1", status: "completed", total_usd } }).chargedUsd, undefined);
}
console.log("PASS: Actual supplier envelope, missing references, provider statuses, and supplier refund does not imply customer refund.");
