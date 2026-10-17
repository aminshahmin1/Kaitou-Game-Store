import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

let session = null;
let calls = 0;
let fail = false;
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../src/app/api/admin/fazercards/balance/route.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports, require(name) {
  if (name === "next/server") return { NextResponse: Response };
  if (name === "@/lib/auth/admin-api") return { getAdminApiSession: async () => session };
  if (name === "@/lib/funding-cost") return { getFundingCostBasis: async () => ({ rate: 4.137857, label: "Recorded cost" }) };
  if (name === "@/lib/integrations/fazercards-balance") return { getFazerCardsBalance: async () => {
    calls++;
    if (fail) throw new Error("Private supplier details");
    return { balanceUsd: calls, currency: "USD", checkedAt: new Date().toISOString() };
  } };
  throw new Error(`Unexpected dependency ${name}`);
} });
assert.equal((await exports.GET()).status, 401);
assert.equal(calls, 0);
session = { role: "owner" };
const first = await exports.GET();
assert.equal(first.status, 200);
assert.equal(first.headers.get("cache-control"), "private, no-store");
assert.equal((await first.json()).balance.balanceUsd, 1);
assert.equal((await (await exports.GET()).json()).balance.balanceUsd, 2);
fail = true;
const failure = await exports.GET();
assert.equal(failure.status, 503);
assert.ok(!(await failure.text()).includes("Private supplier"));
console.log("PASS: Balance sync requires login, returns fresh no-store responses, and safely reports provider failure.");

const state = [];
const effects = [];
const listeners = new Map();
let tick;
let requestCount = 0;
let sync;
let now = Date.now();
let offline = false;
const document = { visibilityState: "visible", addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: (key) => listeners.delete(key) };
const client = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../src/components/admin-balance-live.tsx", import.meta.url), "utf8"), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, {
  exports: client, AbortController, Intl, document,
  Date: class extends Date { static now() { return now; } },
  window: {
    setTimeout: () => 1, clearTimeout: () => {},
    setInterval: (fn, delay) => { assert.equal(delay, 60000); tick = fn; return 1; },
    clearInterval: () => { tick = null; },
    addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: (key) => listeners.delete(key),
  },
  fetch: async () => {
    requestCount++;
    return { ok: !offline, json: async () => ({ balance: { balanceUsd: requestCount, checkedAt: new Date(now).toISOString() }, basis: null }) };
  },
  require(name) {
    if (name === "react") return {
      useState(value) { const index = state.length; state.push(value); return [value, (next) => { state[index] = next; }]; },
      useRef: (current) => ({ current }), useEffect: (fn) => effects.push(fn),
      useCallback: (fn) => { sync = fn; return fn; },
    };
    if (name === "react/jsx-runtime") return { jsx: () => null, jsxs: () => null };
    if (name === "lucide-react") return { RefreshCw: () => null };
    if (name === "@/lib/cost-conversion") return {};
    throw new Error(`Unexpected client dependency ${name}`);
  },
});
client.AdminBalanceLive({ initialBalance: null, initialBasis: null });
const cleanup = effects[0]();
await new Promise(setImmediate);
assert.equal(requestCount, 1);
assert.equal(state[0].balanceUsd, 1);
await sync();
assert.equal(requestCount, 1); // Immediate repeated requests are throttled.
document.visibilityState = "hidden";
now += 60000;
tick();
assert.equal(requestCount, 1);
document.visibilityState = "visible";
listeners.get("visibilitychange")();
await new Promise(setImmediate);
assert.equal(requestCount, 2);
now += 60000;
tick();
await new Promise(setImmediate);
assert.equal(requestCount, 3);
now += 6000;
offline = true;
await sync();
assert.equal(state[0].balanceUsd, 3);
assert.match(state[3], /last successful reading/);
assert.equal(state[2], false);
cleanup();
assert.equal(tick, null);
assert.equal(listeners.size, 0);
console.log("PASS: Initial sync, visible-tab polling, return-to-tab refresh, repeat throttling, stale-error state and cleanup.");
