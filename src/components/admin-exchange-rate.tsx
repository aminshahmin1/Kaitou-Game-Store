"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Save } from "lucide-react";

export function AdminExchangeRate({ initialRate }: { initialRate: number }) {
  const [rate, setRate] = useState(String(initialRate));
  const [savedRate, setSavedRate] = useState(initialRate);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/admin/exchange-rate", { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rate: Number(rate) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Exchange rate could not be saved.");
      setSavedRate(body.rate); setRate(String(body.rate));
      setMessage("Saved. All USD-based product costs now use this rate. Selling prices are unchanged.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Exchange rate could not be saved. Please try again."); }
    finally { setSaving(false); }
  }
  return <section className="border-y border-slate-200 py-6">
    <h2 className="text-xl font-bold">Supplier exchange rate</h2>
    <p className="mt-2 text-sm text-slate-600">Current rate: USD 1 = RM {savedRate.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")}</p>
    <form onSubmit={save} className="mt-4 flex flex-wrap items-end gap-3">
      <label className="grid min-w-0 gap-2 text-sm font-semibold">MYR per USD
        <input type="number" required min="0.000001" max="10000" step="0.000001" value={rate}
          onChange={(event) => setRate(event.target.value)} disabled={saving}
          className="w-52 max-w-full rounded-md border border-slate-300 px-3 py-3" />
      </label>
      <button disabled={saving} type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-50">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save rate
      </button>
    </form>
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
  </section>;
}
