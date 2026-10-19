import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const exports = {};
const env = {};
let sent;
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../src/lib/integrations/fazercards.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports, AbortSignal, fetch: async (url, options) => { sent={url,options,body:JSON.parse(options.body)}; return {ok:true,json:async()=>({ok:true,order:{id:"ord-42",status:"processing",total_usd:"1.0000"}})}; }, require: () => ({}), process: { env } });
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
env.FAZERCARDS_API_KEY="fixture-only";
await exports.createFazerCardsOrder({orderId:"KGS-STEAM-FIXTURE",product:{type:"steam_gift_game"},variation:{sku:"fixture",fazercardsSku:"123:456:MY"},fieldValues:{steam_invite_url:"https://s.team/p/abc-def/ghijk"}});
assert.ok(sent.url.endsWith("/steam-gifts/order"));
assert.deepEqual(sent.body,{invite_url:"https://s.team/p/abc-def/ghijk",sub_id:456,app_id:123,region:"MY"});
assert.equal(sent.options.headers["Idempotency-Key"],"KGS-STEAM-FIXTURE");
console.log("PASS: Steam gift request uses the confirmed app, edition, region, invite and idempotency key; isolated supplier only.");
