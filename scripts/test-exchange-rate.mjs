import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
const require = createRequire(import.meta.url);
let session = null, calls = 0, failure = false;
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../src/app/api/admin/exchange-rate/route.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports, URL, require(name) {
  if (name === "next/server") return { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } };
  if (name === "@/lib/auth/admin-api") return { getAdminApiSession: async (permission) => { assert.equal(permission, "settings"); return session; } };
  if (name === "@/lib/supabase/admin") return { createSupabaseAdminClient: () => ({ rpc: async (name, args) => {
    assert.equal(name, "set_supplier_exchange_rate"); calls++;
    return { data: { rate: args.p_rate }, error: failure ? { message: "Private DB details" } : null };
  } }) };
  return require(name);
} });
const request = (rate, origin = "https://kaitou.shop") => new Request("https://kaitou.shop/api/admin/exchange-rate", {
  method: "POST", headers: origin ? { origin } : {}, body: JSON.stringify({ rate }),
});
assert.equal((await exports.POST(request(4.08))).status, 401);
session = { role: "staff" }; assert.equal((await exports.POST(request(4.08))).status, 403);
session = { role: "owner" };
assert.equal((await exports.POST(request(4.08, "https://example.invalid"))).status, 403);
assert.equal((await exports.POST(request(4.08, ""))).status, 403);
for (const rate of [0, -1, 10001, "4.08", 4.1234567, null]) assert.equal((await exports.POST(request(rate))).status, 400);
assert.equal(calls, 0);
for (const rate of [4.08, 4.25, 4.123456]) {
  const response = await exports.POST(request(rate)); assert.equal(response.status, 200); assert.equal(response.body.rate, rate);
}
failure = true;
const failed = await exports.POST(request(4.08)); assert.equal(failed.status, 503);
assert.ok(!JSON.stringify(failed).includes("Private DB"));
console.log("PASS: Exchange rate owner-only permissions, same-origin checks, precision/range validation, atomic RPC and safe failures.");
