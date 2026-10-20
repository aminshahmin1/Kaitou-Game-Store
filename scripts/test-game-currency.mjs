import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const exports={};vm.runInNewContext(ts.transpileModule(readFileSync("src/lib/game-currency.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports});
for(const [source,name,unit]of [["Genshin Impact (Global) (Global) | Genesis Crystals","Genshin Impact","Genesis Crystals"],["Mobile Legends (MY) | Diamonds","Mobile Legends","Diamonds"],["PUBG Mobile (Auto) (Global) | UC","PUBG Mobile","UC"],["Free Fire (MY/SG) (MY) | Diamonds","Free Fire","Diamonds"],["Wuthering Waves (Global) | Lunite","Wuthering Waves","Lunite"]]){const found=exports.getGameCurrency(source);assert.equal(found.name,name);assert.equal(found.unit,unit);assert.ok(existsSync("public"+found.image));}
assert.equal(exports.getGameCurrency("New Game (MY) (MY) | Credits").name,"New Game");assert.equal(exports.getGameCurrency("New Game").image,null);
const sql=readFileSync("docs/currency-ranking-top-100.sql","utf8");assert.match(sql,/place<=100/);assert.ok(!sql.includes("limit 500"));assert.match(sql,/security invoker/);assert.match(sql,/revoke all.*public,anon,authenticated/);
console.log("PASS: short game names, correct currency assets, unknown-game fallback and private top-100 query contract.");
