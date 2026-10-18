import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(path, dependencies) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, require(name) {
    if (name === "server-only") return {};
    if (name in dependencies) return dependencies[name];
    return require(name);
  } });
  return exports;
}
const payload = { orderNumber: "KGS-QA", status: "processing", product: "Mobile Legends", variation: "13 + 1", name: "Buyer",
  email: "buyer@example.test", whatsapp: "0123456789", fields: { user_id: "00123" }, amountMyr: 2.1,
  subtotalMyr: 1.1, feeMyr: 1, paidAt: "2026-10-18", refundReference: null };
let job = { id: "mail", audience: "customer", payload, lease_token: "lease", attempts: 1 };
let patch;
let sent;
let sendFails = false;
const mailDb = { rpc: async () => ({ data: job ? [job] : [], error: null }), from() {
  const q = { update(value) { patch = value; return q; }, eq() { return q; },
    then(resolve) { return Promise.resolve({ error: null }).then(resolve); } };
  return q;
} };
const emailTemplates = load("../src/lib/integrations/email.ts", {});
const emails = load("../src/lib/order-emails.ts", {
  "./supabase/admin": { createSupabaseAdminClient: () => mailDb },
  "./integrations/email": { ...emailTemplates, getEmailConfiguration: () => ({ recipient: "owner@example.test" }),
    sendStoreEmail: async (...args) => { sent = args; if (sendFails) throw new Error("SMTP unavailable"); } },
});
const customer = emails.formatOrderEmail(payload, "customer");
assert.match(customer.text, /Order total: RM2.10/);
assert.match(customer.text, /user id: 00123/);
assert.match(customer.text, /Payment received: .*MYT/);
assert.match(customer.text, /FPX fee: RM1.00/);
assert.match(customer.html, /Your payment receipt/);
assert.match(customer.html, /KAITOU/);
assert.match(emails.formatOrderEmail(payload, "admin").text, /user id: 00123/);
for (const status of ["processing", "completed", "failed", "review", "refunded"]) {
  const receipt = emails.formatOrderEmail({ ...payload, status, paymentReference: "bill-123", refundReference: "refund-123" }, "customer");
  assert.match(receipt.text, /Order total: RM2.10/);
  assert.match(receipt.text, /Payment reference: bill-123/);
  assert.match(receipt.html, /RM2.10/);
}
const escaped = emails.formatOrderEmail({ ...payload, name: '<img src=x onerror="alert(1)">', fields: { player_id: "<script>bad</script>" } }, "customer");
assert.ok(!escaped.html.includes('<img src=x'));
assert.ok(!escaped.html.includes('<script>'));
assert.match(escaped.html, /&lt;script&gt;/);
assert.throws(() => emails.formatOrderEmail({ ...payload, paidAt: "invalid" }, "customer"));
assert.throws(() => emails.formatOrderEmail({ ...payload, status: "pending_payment" }, "customer"));
assert.equal((await emails.deliverNextOrderEmail()).sent, 1);
assert.equal(sent[0], payload.email);
assert.equal(sent[3], "<order-mail@kaitou.shop>");
assert.match(sent[4], /Your payment receipt/);
assert.equal(patch.state, "sent");
job.audience = "admin";
await emails.deliverNextOrderEmail();
assert.equal(sent[0], "owner@example.test");
sendFails = true;
await emails.deliverNextOrderEmail();
assert.equal(patch.state, "pending");
job.attempts = 5;
await emails.deliverNextOrderEmail();
assert.equal(patch.state, "failed");
job = null;
assert.equal((await emails.deliverNextOrderEmail()).sent, 0);

let order = { id: "one", order_number: "KGS-QA", payment_reference: "bill", status: "pending_payment", paid_at: null, updated_at: "old" };
let transactions = [];
let reconciled = null;
let outage = false;
const payDb = { from() {
  let update;
  const filters = [];
  const q = { select() { return q; }, order() { return q; }, limit() { return q; }, gte() { return q; },
    eq(key, value) { filters.push((r) => r[key] === value); return q; },
    is(key, value) { filters.push((r) => r[key] === value); return q; },
    not(key, _op, value) { filters.push((r) => r[key] !== value); return q; },
    update(value) { update = value; return q; },
    async maybeSingle() { return { data: order ? structuredClone(order) : null, error: null }; },
    then(resolve) { if (order && filters.every((f) => f(order))) Object.assign(order, update); return Promise.resolve({ error: null }).then(resolve); },
  }; return q;
} };
const payments = load("../src/lib/payment-reconciliation.ts", {
  "./supabase/admin": { createSupabaseAdminClient: () => payDb },
  "./integrations/toyyibpay": { getToyyibPayTransactions: async () => { if (outage) throw new Error("Gateway offline"); return transactions; } },
  "./orders": { markOrderPaymentCallback: async (input) => { reconciled = input; order.paid_at = "confirmed"; order.status = "processing"; return { processed: true }; } },
});
assert.equal((await payments.reconcileNextPayment()).paid, 0);
assert.notEqual(order.updated_at, "old");
transactions = [{ billpaymentStatus: "1", billExternalReferenceNo: "WRONG", billpaymentAmount: "2.10" }];
await payments.reconcileNextPayment();
assert.equal(reconciled, null);
transactions[0].billExternalReferenceNo = "KGS-QA";
assert.equal((await payments.reconcileNextPayment()).paid, 1);
assert.equal(reconciled.amountMyr, 2.1);
assert.equal(order.status, "processing");
order.status = "pending_payment"; order.paid_at = null; order.updated_at = "old"; outage = true;
await assert.rejects(payments.reconcileNextPayment(), /Gateway offline/);
assert.notEqual(order.updated_at, "old");
console.log("PASS: Receipt totals, audience privacy, delivery retries, empty queue, missed-payment verification, reference matching and unpaid rotation.");
