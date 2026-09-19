import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";
import { createHash } from "node:crypto";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const env = { TOYYIBPAY_SECRET_KEY: "test-secret", TOYYIBPAY_CATEGORY_CODE: "test-category", NEXT_PUBLIC_SITE_URL: "https://kaitou.shop", CHECKOUT_ENABLED: "false" };
let order, tests, purchases = 0, confirmed = true, bodySent, session = null;
let failBill = false;
function reset() {
  order = { id: "order1", order_number: "KGS-TEST", status: "pending_payment", payment_reference: "bill123", amount_myr: 10, paid_at: null, fulfillment_reference: null, products: { id: "p1", type: "topup" }, product_variations: { id: "v1" }, customer_fields: {} };
  tests = [{ id: "KTEST-TEST", bill_code: "testbill", status: "pending", amount_myr: 1 }];
  purchases = 0;
  confirmed = true;
}
reset();
const database = {
  from(table) {
    const filters = [];
    let update;
    const execute = () => {
      const rows = (table === "orders" ? [order] : tests).filter((row) => filters.every((filter) => filter(row)));
      if (update) rows.forEach((row) => Object.assign(row, update));
      return { data: rows.map((row) => structuredClone(row)), error: null };
    };
    const query = {
      select() { return query; },
      eq(key, value) { filters.push((row) => row[key] === value); return query; },
      is(key, value) { filters.push((row) => row[key] === value); return query; },
      neq(key, value) { filters.push((row) => row[key] !== value); return query; },
      in(key, values) { filters.push((row) => values.includes(row[key])); return query; },
      update(value) { update = value; return query; },
      async maybeSingle() { const result = execute(); return { ...result, data: result.data[0] ?? null }; },
      then(resolve) { return Promise.resolve(execute()).then(resolve); },
    };
    return query;
  },
};
const cache = new Map();
function load(file) {
  const absolute = path.resolve(root, file);
  if (cache.has(absolute)) return cache.get(absolute);
  const exports = {};
  cache.set(absolute, exports);
  vm.runInNewContext(ts.transpileModule(readFileSync(absolute, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, {
    exports, process: { env }, console, Buffer, Date, URL, URLSearchParams, AbortSignal,
    fetch: async (url, options) => {
      if (url.endsWith("createBill")) {
        bodySent = options.body;
        return new Response(failBill ? "[CATEGORY-NOT-MATCH]" : JSON.stringify([{ BillCode: "bill123" }]));
      }
      if (url.endsWith("getCategoryDetails")) return Response.json({ categoryStatus: "1" });
      assert.ok(url.endsWith("getBillTransactions"));
      const isTest = options.body.get("billCode") === "testbill";
      return Response.json(confirmed ? [{ billpaymentStatus: "1", billExternalReferenceNo: isTest ? "KTEST-TEST" : "KGS-TEST", billpaymentAmount: isTest ? "1.00" : "10.00" }] : []);
    },
    require(name) {
      if (name === "server-only") return {};
      if (name === "next/server") return { NextResponse: Response };
      if (name.endsWith("supabase/admin")) return { createSupabaseAdminClient: () => database };
      if (name.endsWith("auth/admin-api")) return { getAdminApiSession: async () => session };
      if (name === "./integrations/fazercards") return { createFazerCardsOrder: async () => { purchases++; return { status: "processing", providerReference: "fazer123" }; } };
      if (name === "./revenue") return { allocateFundingForOrder: async () => {} };
      if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`);
      if (name.startsWith(".")) return load(path.resolve(path.dirname(absolute), `${name}.ts`));
      return require(name);
    },
  }, { filename: absolute });
  return exports;
}
const provider = load("src/lib/integrations/toyyibpay.ts");
const payer = { orderId: "KGS-TEST", description: "Test", amountMyr: 10, customerName: "QA", customerEmail: "qa@example.test", whatsapp: "+60 123-456789" };
await provider.createToyyibPayPayment(payer);
assert.equal(bodySent.get("billPaymentChannel"), "0");
assert.equal(bodySent.get("billChargeToCustomer"), "");
assert.equal(bodySent.get("billAmount"), "1000");
assert.equal(bodySent.get("billPhone"), "60123456789");
assert.equal(new URL(bodySent.get("billReturnUrl")).searchParams.get("order_id"), "KGS-TEST");
await assert.rejects(provider.createToyyibPayPayment({ ...payer, amountMyr: 0.43 }), /at least RM1/);
failBill = true;
await assert.rejects(provider.createToyyibPayPayment(payer), /did not return a bill code/);
failBill = false;
assert.equal((await provider.checkToyyibPayCategory()).active, true);

const webhook = load("src/app/api/webhooks/toyyibpay/route.ts");
function callback(overrides = {}) {
  const payload = { status: "1", order_id: "KGS-TEST", billcode: "bill123", refno: "payment1", amount: "10.00", ...overrides };
  const hash = createHash("md5").update(`${env.TOYYIBPAY_SECRET_KEY}${payload.status}${payload.order_id}${payload.refno}ok`).digest("hex");
  return new Request("https://kaitou.shop/api/webhooks/toyyibpay", { method: "POST", body: new URLSearchParams({ hash, ...payload }) });
}
assert.equal((await webhook.POST(callback({ hash: "wrong" }))).status, 400);
assert.equal((await webhook.POST(callback({ amount: "" }))).status, 400);
assert.equal((await webhook.POST(callback({ status: "9" }))).status, 400);
assert.equal(purchases, 0);
confirmed = false;
assert.equal((await webhook.POST(callback())).status, 503);
assert.equal(order.paid_at, null);
confirmed = true;
const concurrent = await Promise.all([webhook.POST(callback()), webhook.POST(callback()), webhook.POST(callback())]);
assert.ok(concurrent.every((response) => response.status === 200));
assert.equal(purchases, 1);
assert.ok(order.paid_at);
order.status = "completed";
assert.equal((await webhook.POST(callback({ status: "3" }))).status, 200);
assert.equal(order.status, "completed");
reset();
assert.equal((await webhook.POST(callback({ billcode: "wrongbill" }))).status, 409);
assert.equal(purchases, 0);
order.amount_myr = 11;
assert.equal((await webhook.POST(callback())).status, 200);
assert.equal(order.status, "review");
assert.equal(purchases, 0);
reset();
assert.equal((await webhook.POST(callback({ status: "3" }))).status, 200);
assert.equal(order.status, "pending_payment");
assert.equal(order.paid_at, null);
assert.equal((await webhook.POST(callback({ order_id: "KTEST-TEST", billcode: "testbill", amount: "1.00" }))).status, 200);
assert.equal(tests[0].status, "success");
assert.ok(tests[0].callback_received_at);
assert.equal(purchases, 0);
const admin = load("src/app/api/admin/integrations/toyyibpay/route.ts");
assert.equal((await admin.GET(new Request("https://kaitou.shop/api/admin/integrations/toyyibpay"))).status, 403);
session = { role: "staff" };
assert.equal((await admin.POST({ json: async () => payer })).status, 403);
console.log("PASS: FPX bills, fee settings, minimum amount, provider errors, signatures, provider verification, concurrent callbacks, late failures, amount mismatch, isolated RM1 callback, and owner-only access.");
