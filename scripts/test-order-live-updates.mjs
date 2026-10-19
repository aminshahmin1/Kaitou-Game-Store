import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const values = [], effects = [], listeners = new Map();
let tick, calls = 0, finish;
const document = { visibilityState: "visible", addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: (key) => listeners.delete(key) };
const jsx = (type, props) => ({ type, props });
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../src/components/admin-review-queue.tsx", import.meta.url), "utf8"), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, {
  exports, Intl, document,
  window: { setInterval(fn, delay) { assert.equal(delay, 15000); tick = fn; return 1; }, clearInterval() { tick = null; },
    addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: (key) => listeners.delete(key) },
  fetch: async (url, options) => {
    calls++;
    assert.equal(url, "/api/admin/orders?scope=all"); assert.equal(options.cache, "no-store");
    return await new Promise((resolve) => { finish = () => resolve({ ok: true, json: async () => ({ orders: [{ ...order, status: "completed" }] }) }); });
  },
  require(name) {
    if (name === "react") return {
      useState(value) { const index = values.length; const current = typeof value === "function" ? value() : value; values.push(current);
        return [current, (next) => { values[index] = typeof next === "function" ? next(values[index]) : next; }]; },
      useRef: (current) => ({ current }), useEffect: (fn) => effects.push(fn),
    };
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (name === "lucide-react") return {};
    throw new Error(`Unexpected dependency ${name}`);
  },
});
const order = { id: "fixture", status: "processing", updatedAt: new Date().toISOString(), amountMyr: 10,
  orderNumber: "DEVELOPMENT-ONLY", customerFields: {} };
const tree = exports.AdminReviewQueue({ initialOrders: [order], allPaid: true });
const cleanup = effects[0]();
document.visibilityState = "hidden";
tick(); assert.equal(calls, 0);
document.visibilityState = "visible";
listeners.get("visibilitychange")(); assert.equal(calls, 1);
tick(); assert.equal(calls, 1); // In-flight polling cannot overlap.
finish(); await new Promise(setImmediate);
assert.equal(values[0][0].status, "completed");

function find(node, type) {
  if (!node || typeof node !== "object") return null;
  if (node.type === type) return node;
  return [node.props?.children].flat(Infinity).map((child) => find(child, type)).find(Boolean);
}
tick(); assert.equal(calls, 2);
find(tree, "select").props.onChange({ target: { value: "review" } });
finish(); await new Promise(setImmediate);
assert.equal(values[1].fixture.status, "review", "Polling must preserve unsaved support edits");
listeners.get("focus")(); assert.equal(calls, 2);
cleanup(); assert.equal(tick, null); assert.equal(listeners.size, 0);
console.log("PASS: Paid-order live updates, hidden-tab pause, no overlapping polls, unsaved-draft preservation and cleanup.");
