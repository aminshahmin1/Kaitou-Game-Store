import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../src/lib/cost-conversion.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports });
const rate = 57.93 / 14;
assert.equal(exports.estimateCostMyr(14, rate), 57.93);
assert.equal(exports.estimateCostMyr(0.2317, rate), 0.96);
assert.equal(exports.estimateCostMyr(1.9344, rate), 8);
assert.equal(exports.estimateCostMyr(0, rate), 0);
assert.equal(exports.estimateCostMyr(5, 0), 0);
for (const value of [NaN, Infinity, -1]) {
  assert.throws(() => exports.estimateCostMyr(value, rate));
  assert.throws(() => exports.estimateCostMyr(1, value));
}
console.log("PASS: Fee-inclusive funding conversion, cent rounding, zero cost and invalid inputs.");
