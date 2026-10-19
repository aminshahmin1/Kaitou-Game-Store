import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { timingSafeEqual } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
const exports = {}, env = {};
let calls = 0, fail = false;
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../src/app/api/cron/revenue/route.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports, Buffer, process: { env }, require(name) {
  if (name === "node:crypto") return { timingSafeEqual };
  if (name === "next/server") return { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } };
  if (name === "@/lib/revenue") return { allocatePaidOrdersFunding: async (options) => {
    calls++; assert.equal(options.manualOnly, true); assert.equal(options.limit, 25);
    if (fail) throw Error("Private database details"); return { allocatedOrders: 1 };
  } };
  throw Error(name);
} });
const request = (authorization) => ({ headers: new Headers(authorization ? { authorization } : {}) });
assert.equal((await exports.POST(request())).status, 401);
env.BALANCE_MONITOR_SECRET = "development-only";
assert.equal((await exports.POST(request("Bearer wrong"))).status, 401);
assert.equal(calls, 0);
assert.equal((await exports.POST(request("Bearer development-only"))).body.allocatedOrders, 1);
fail = true;
const failed = await exports.POST(request("Bearer development-only"));
assert.equal(failed.status, 503); assert.ok(!JSON.stringify(failed).includes("Private database"));
console.log("PASS: Authenticated bounded automatic profit reconciliation and safe retry errors.");
