"use client";

import { useState } from "react";
import { ExternalLink, RefreshCw, CreditCard } from "lucide-react";

type PaymentTest = { id: string; bill_code: string | null; status: string; callback_received_at: string | null };

export function AdminToyyibPay() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [tests, setTests] = useState<PaymentTest[]>([]);
  const [paymentUrl, setPaymentUrl] = useState("");

  async function check(id?: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/integrations/toyyibpay${id ? `?test=${encodeURIComponent(id)}` : ""}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (id) {
        const test = data.test;
        setTests((current) => current.map((row) => row.id === test.id ? test : row));
        setMessage(test.providerConfirmed
          ? test.callback_received_at && test.status === "success"
            ? "RM1 payment confirmed. The signed callback was received successfully."
            : "ToyyibPay confirms payment. The successful callback has not arrived yet; check again shortly."
          : "No successful payment confirmed for this test yet.");
      } else {
        setTests(data.tests);
        setMessage(`${data.connection.active ? "ToyyibPay connected. Category is active." : "ToyyibPay is not ready. Check the secret key and category in Vercel."} Customer checkout is ${data.checkoutEnabled ? "enabled" : "disabled"}.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Connection check failed.");
    } finally {
      setBusy(false);
    }
  }

  async function createTest(form: FormData) {
    setBusy(true);
    setMessage("");
    setPaymentUrl("");
    try {
      const response = await fetch("/api/admin/integrations/toyyibpay", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setPaymentUrl(data.test.paymentUrl);
      await check();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not confirm bill creation. Check the connection before retrying.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border-b border-slate-200 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h2 className="font-display text-2xl font-bold">ToyyibPay FPX</h2><p className="mt-2 text-sm text-slate-600">MYR payments. Transaction fees are charged to the store.</p></div>
        <button type="button" disabled={busy} onClick={() => void check()} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-3 text-sm font-bold disabled:opacity-50"><RefreshCw className="h-4 w-4" />Check connection</button>
      </div>
      {message && <p role="status" className="mt-4 rounded-md bg-sky-50 p-4 text-sm text-sky-900">{message}</p>}
      <h3 className="mt-6 text-lg font-bold">RM1 payment test</h3>
      <p className="mt-2 text-sm text-slate-600">This is a real RM1 payment to your store, with the applicable FPX fee. It will not purchase games, use FazerCards credit, or appear as sales revenue.</p>
      <form action={createTest} className="mt-4 grid gap-4 md:grid-cols-3">
        <label className="grid gap-2 text-sm font-semibold">Name<input name="customerName" required minLength={2} maxLength={80} className="min-w-0 rounded-md border border-slate-300 px-3 py-3" /></label>
        <label className="grid gap-2 text-sm font-semibold">Email<input name="customerEmail" type="email" required className="min-w-0 rounded-md border border-slate-300 px-3 py-3" /></label>
        <label className="grid gap-2 text-sm font-semibold">Phone number<input name="whatsapp" type="tel" required minLength={8} maxLength={20} className="min-w-0 rounded-md border border-slate-300 px-3 py-3" /></label>
        <button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"><CreditCard className="h-4 w-4" />Create RM1 test bill</button>
      </form>
      {paymentUrl && <a href={paymentUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 font-bold text-sky-700">Open ToyyibPay payment<ExternalLink className="h-4 w-4" /></a>}
      {tests.length > 0 && <div className="mt-6 divide-y divide-slate-200">{tests.map((test) => <div key={test.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><p className="break-all font-semibold">{test.id}</p><p className="mt-1 text-slate-600">{test.status === "success" ? "Paid" : test.status === "failed" ? "Payment failed" : "Awaiting payment"} · Callback {test.callback_received_at ? "received" : "not received"}</p></div><button type="button" disabled={busy || !test.bill_code} onClick={() => void check(test.id)} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 font-semibold disabled:opacity-50"><RefreshCw className="h-4 w-4" />Verify payment</button></div>)}</div>}
    </section>
  );
}
