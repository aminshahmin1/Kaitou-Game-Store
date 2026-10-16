import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../src/lib/stock.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports });
const product = { available: true, variations: [
  { active: true, available: true, priceMyr: 10, costUsd: 2.5928, fazercardsSku: "a:b" },
  { active: true, available: true, priceMyr: 20, costUsd: 2.5929, fazercardsSku: "a:c" },
  { active: true, available: true, priceMyr: 0.43, costUsd: 0.1, fazercardsSku: "a:d" },
  { active: true, available: true, priceMyr: 10, costUsd: 0, fazercardsSku: "a:e" },
  { active: true, available: false, priceMyr: 10, costUsd: 1, fazercardsSku: "a:f" },
] };
const original = JSON.stringify(product);
const [result] = exports.applyBalanceAvailability([product], 2.5928);
assert.equal(result.available, true);
assert.equal(result.variations[0].available, true);
assert.ok(result.variations.slice(1).every((v) => !v.available));
assert.equal(exports.applyBalanceAvailability([product], null)[0].available, false);
assert.equal(exports.applyBalanceAvailability([product], 0)[0].available, false);
assert.equal(exports.applyBalanceAvailability([product], 10)[0].variations[1].available, true);
assert.equal(JSON.stringify(product), original);
console.log("PASS: Exact balance, insufficient funds, FPX minimum, missing cost, manual unavailability, provider failure and replenishment.");
