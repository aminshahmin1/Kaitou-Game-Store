import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
const require = createRequire(import.meta.url);
const env = { ADMIN_SESSION_SECRET: "unit-test-secret", VERCEL: "1" };
let allowed = true, error = null, captured;
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../src/lib/request-guard.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports, process: { env }, Response, URL, require(name) {
  if (name === "server-only") return {};
  if (name === "./supabase/admin") return { createSupabaseAdminClient: () => ({ rpc: async (_name, args) => {
    captured = args; return { data: [{ allowed, retry_after: 60 }], error };
  } }) };
  return require(name);
} });
const request = (headers = {}) => new Request("https://kaitou.shop/api/test", { headers });
assert.equal(await exports.guardRequest(request({ "x-vercel-forwarded-for": "203.0.113.3" }), "login"), null);
assert.match(captured.p_key, /^[a-f0-9]{64}$/);
assert.equal(captured.p_limit, 10);
const first = captured.p_key;
await exports.guardRequest(request(), "support");
assert.equal(captured.p_limit, 3);
assert.equal(captured.p_seconds, 900);
await exports.guardRequest(request({ "x-vercel-forwarded-for": "203.0.113.4" }), "login");
assert.notEqual(captured.p_key, first);
assert.equal((await exports.guardRequest(request({ origin: "https://evil.test" }), "login")).status, 403);
allowed = false;
const blocked = await exports.guardRequest(request(), "checkout");
assert.equal(blocked.status, 429);
assert.equal(blocked.headers.get("retry-after"), "60");
assert.equal(captured.p_limit, 8);
error = { message: "DB offline" };
assert.equal((await exports.guardRequest(request(), "order-status")).status, 503);
error = null; env.ADMIN_SESSION_SECRET = "";
assert.equal((await exports.guardRequest(request(), "login")).status, 503);
console.log("PASS: Private hashed request keys, scope limits, cross-origin rejection, retry headers and fail-closed protection.");
