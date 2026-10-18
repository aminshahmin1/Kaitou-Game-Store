import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(file, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, require(name) {
    if (name === "server-only") return {};
    return name in dependencies ? dependencies[name] : require(name);
  } });
  return exports;
}
const packages = load("src/lib/custom-packages.ts");
const rankingModule = load("src/lib/currency-ranking.ts", {
  "./custom-packages": packages, "./supabase/admin": {},
});
const product = { type: "topup", game: "Mobile Legends", region: "MY", leaderboardUnit: "Diamonds" };
const variation = { title: "13 + 1 Diamonds", currencyUnits: 14 };
const fields = { player_id: "24407481", server_id: "2029", email: "private@example.test" };
const ranked = rankingModule.makeRankingSnapshot(product, variation, fields);
assert.equal(ranked.ranking_units, 14);
assert.equal(ranked.ranking_player_mask, "****7481");
assert.ok(!JSON.stringify(ranked).includes("24407481"));
assert.ok(!JSON.stringify(ranked).includes("private@example.test"));
assert.notEqual(rankingModule.makeRankingSnapshot(product, variation, { ...fields, server_id: "2030" }).ranking_player_key, ranked.ranking_player_key);
assert.notEqual(rankingModule.makeRankingSnapshot({ ...product, game: "PUBG" }, variation, fields).ranking_player_key, ranked.ranking_player_key);
for (const title of ["Weekly Diamond Pack", "Weekly Pass", "Monthly Elite", "Starter Pack", "Membership", "Subscription"]) {
  assert.equal(rankingModule.makeRankingSnapshot(product, { ...variation, title }, fields).ranking_units, 0);
}
assert.equal(rankingModule.makeRankingSnapshot({ ...product, type: "steam_gift_game" }, variation, fields).ranking_units, 0);
assert.equal(rankingModule.makeRankingSnapshot(product, variation, { email: "private@example.test" }).ranking_units, 0);
assert.equal(rankingModule.makeRankingSnapshot(product, { ...variation, currencyUnits: 0 }, fields).ranking_units, 0);
const [base, custom] = packages.normalizeCustomPackages("topup", [
  { title: "8100 UC", currencyUnits: 8100, costUsd: 80, costMyr: 350, repeatable: true, fazercardsSku: "a:b" },
  { title: "16200 UC", currencyUnits: 1, costUsd: 0, costMyr: 0, supplierQuantity: 2, fazercardsSku: "a:b" },
]);
assert.equal(base.currencyUnits, 8100);
assert.equal(custom.currencyUnits, 16200);
assert.equal(rankingModule.makeRankingSnapshot({ ...product, leaderboardUnit: "UC" }, custom, fields).ranking_units, 16200);
assert.equal(packages.normalizeCustomPackages("topup", [{ ...base, title: "Weekly Diamond Pack" }])[0].currencyUnits, 0);
console.log("PASS: Masked currency snapshots, no spending/PII, game/server identity separation, pack/pass exclusion and automatic custom-package units.");
