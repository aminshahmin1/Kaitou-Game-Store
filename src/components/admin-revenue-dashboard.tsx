"use client";

import { useMemo, useState } from "react";
import {
  BarChart3,
  CircleDollarSign,
  Layers3,
  Loader2,
  Play,
  PlusCircle,
  RefreshCw,
} from "lucide-react";

import type { RevenueDashboardData } from "@/lib/revenue";

export function AdminRevenueDashboard({ initialData }: { initialData: RevenueDashboardData }) {
  const [data, setData] = useState(initialData);
  const [from, setFrom] = useState(initialData.range.from);
  const [to, setTo] = useState(initialData.range.to);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [isAllocating, setIsAllocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const exportHref = useMemo(() => {
    const params = new URLSearchParams({ from, to });
    return `/api/admin/revenue/export?${params.toString()}`;
  }, [from, to]);

  const impliedRate = useMemo(() => {
    const batch = data.fundingBatches[0];
    if (!batch) {
      return "Add a top-up batch to start tracking real cost.";
    }

    return `Latest batch rate: RM ${batch.effectiveRate.toFixed(4)} per USDT`;
  }, [data.fundingBatches]);

  async function loadRevenue(nextFrom = from, nextTo = to) {
    setIsLoading(true);
    setMessage(null);

    const params = new URLSearchParams({ from: nextFrom, to: nextTo });
    const response = await fetch(`/api/admin/revenue?${params.toString()}`);
    const body = await response.json().catch(() => ({}));
    setIsLoading(false);

    if (!response.ok) {
      setMessage(body.error ?? "Revenue data could not be loaded.");
      return;
    }

    setData(body.data);
  }

  async function onCreateFundingBatch(formData: FormData) {
    setIsSavingBatch(true);
    setMessage(null);

    const response = await fetch("/api/admin/revenue/funding-batches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topupDate: String(formData.get("topupDate") ?? ""),
        myrSpent: Number(formData.get("myrSpent") ?? 0),
        usdCredited: Number(formData.get("usdCredited") ?? 0),
        feesMyr: Number(formData.get("feesMyr") ?? 0),
        reference: String(formData.get("reference") ?? ""),
        notes: String(formData.get("notes") ?? ""),
      }),
    });
    const body = await response.json().catch(() => ({}));
    setIsSavingBatch(false);

    if (!response.ok) {
      setMessage(body.error ?? "Funding batch could not be saved.");
      return;
    }

    setMessage("Funding batch saved. New paid orders can now use this balance for FIFO costing.");
    setFormKey((current) => current + 1);
    await loadRevenue();
  }

  async function allocateFunding() {
    setIsAllocating(true);
    setMessage(null);

    const response = await fetch("/api/admin/revenue/allocate", { method: "POST" });
    const body = await response.json().catch(() => ({}));
    setIsAllocating(false);

    if (!response.ok) {
      setMessage(body.error ?? "Funding allocation could not be completed.");
      return;
    }

    const result = body.result;
    const skippedCount = result?.skippedOrders?.length ?? 0;
    setMessage(
      skippedCount > 0
        ? `Allocated ${result.allocatedOrders} order(s). ${skippedCount} order(s) need more funding balance.`
        : `Allocated ${result.allocatedOrders} order(s).`,
    );
    await loadRevenue();
  }

  function applyQuickRange(kind: "today" | "week" | "month") {
    const today = new Date();
    let nextFrom = toInputDate(today);

    if (kind === "week") {
      const day = today.getDay();
      const mondayOffset = day === 0 ? 6 : day - 1;
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - mondayOffset);
      nextFrom = toInputDate(weekStart);
    }

    if (kind === "month") {
      nextFrom = toInputDate(new Date(today.getFullYear(), today.getMonth(), 1));
    }

    const nextTo = toInputDate(today);
    setFrom(nextFrom);
    setTo(nextTo);
    void loadRevenue(nextFrom, nextTo);
  }

  return (
    <>
      <section className="grid gap-4 lg:grid-cols-4">
        <SummaryCard label="Revenue" value={formatMyr(data.summary.revenueMyr)} icon={CircleDollarSign} />
        <SummaryCard label="Allocated cost" value={formatMyr(data.summary.allocatedCostMyr)} icon={Layers3} />
        <SummaryCard label="Gross profit" value={formatMyr(data.summary.grossProfitMyr)} icon={BarChart3} />
        <SummaryCard label="Net profit" value={formatMyr(data.summary.netProfitMyr)} icon={BarChart3} />
      </section>

      {data.summary.isLowFundingBalance ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
          <h2 className="font-display text-2xl font-bold">Low funding balance</h2>
          <p className="mt-2">
            Available balance is {data.summary.availableFundingUsd.toFixed(4)} USDT. Your alert threshold is{" "}
            {data.summary.lowFundingThresholdUsd.toFixed(4)} USDT, and pending unallocated cost is{" "}
            {data.summary.pendingCostUsd.toFixed(4)} USDT.
          </p>
          <p className="mt-2 font-semibold">
            Reminder for later: after email or WhatsApp API is configured, connect this alert to owner notifications.
          </p>
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
            <div>
              <h2 className="font-display text-3xl font-bold">Profit report</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Costs are counted after orders are allocated to your FazerCards funding batches.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => applyQuickRange("today")} className="rounded-md border border-slate-200 px-3 py-2 text-sm font-bold">
                Today
              </button>
              <button type="button" onClick={() => applyQuickRange("week")} className="rounded-md border border-slate-200 px-3 py-2 text-sm font-bold">
                Week
              </button>
              <button type="button" onClick={() => applyQuickRange("month")} className="rounded-md border border-slate-200 px-3 py-2 text-sm font-bold">
                Month
              </button>
              <a href={exportHref} className="rounded-md bg-slate-950 px-3 py-2 text-sm font-bold text-white">
                Export CSV
              </a>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              From
              <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="rounded-md border border-slate-200 px-3 py-3" />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              To
              <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="rounded-md border border-slate-200 px-3 py-3" />
            </label>
            <button
              type="button"
              onClick={() => void loadRevenue()}
              disabled={isLoading}
              className="inline-flex min-h-12 items-center justify-center gap-2 self-end rounded-md bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <MiniStat label="Paid orders" value={data.summary.paidOrders.toString()} />
            <MiniStat label="Allocated orders" value={data.summary.allocatedOrders.toString()} />
            <MiniStat label="Pending allocation" value={data.summary.unallocatedOrders.toString()} tone={data.summary.unallocatedOrders > 0 ? "amber" : "slate"} />
            <MiniStat label="Unallocated revenue" value={formatMyr(data.summary.unallocatedRevenueMyr)} tone={data.summary.unallocatedRevenueMyr > 0 ? "amber" : "slate"} />
            <MiniStat label="Pending cost" value={`${data.summary.pendingCostUsd.toFixed(4)} USDT`} tone={data.summary.pendingCostUsd > 0 ? "amber" : "slate"} />
            <MiniStat label="Payment fees" value={formatMyr(data.summary.paymentFeesMyr)} />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-display text-3xl font-bold">Funding balance</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">{impliedRate}</p>
          <div className="mt-5 grid gap-3">
            <MiniStat label="Total funded" value={`${data.summary.totalFundingUsd.toFixed(4)} USDT`} />
            <MiniStat label="MYR spent" value={formatMyr(data.summary.totalFundingMyr)} />
            <MiniStat label="Available balance" value={`${data.summary.availableFundingUsd.toFixed(4)} USDT`} tone={data.summary.availableFundingUsd > 0 ? "emerald" : "amber"} />
            <MiniStat label="Blended rate" value={`RM ${data.summary.blendedFundingRate.toFixed(4)}`} />
          </div>
          <button
            type="button"
            onClick={() => void allocateFunding()}
            disabled={isAllocating}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-sky-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {isAllocating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Allocate pending paid orders
          </button>
        </div>
      </section>

      {message ? (
        <div className="rounded-md border border-sky-100 bg-sky-50 p-3 text-sm font-semibold text-sky-800">
          {message}
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <form key={formKey} action={onCreateFundingBatch} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="font-display text-3xl font-bold">Add funding batch</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Enter what you spent in RM and how much USDT/FazerCards balance was credited.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field name="topupDate" label="Top-up date" type="date" defaultValue={toInputDate(new Date())} />
            <Field name="myrSpent" label="MYR spent" type="number" placeholder="480.00" />
            <Field name="usdCredited" label="USDT credited" type="number" placeholder="100.0000" step="0.0001" />
            <Field name="feesMyr" label="Fees MYR" type="number" placeholder="0.00" />
          </div>
          <Field name="reference" label="Reference" placeholder="Binance transfer / FazerCards top-up ref" required={false} />
          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Notes
            <textarea name="notes" className="min-h-20 rounded-md border border-slate-200 px-3 py-3" placeholder="Optional internal note" />
          </label>
          <button
            type="submit"
            disabled={isSavingBatch}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {isSavingBatch ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
            Save funding batch
          </button>
        </form>

        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="font-display text-3xl font-bold">Funding ledger</h2>
            <p className="mt-1 text-sm text-slate-500">Oldest available balance is used first when allocating order cost.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Credited</th>
                  <th className="px-4 py-3">MYR spent</th>
                  <th className="px-4 py-3">Rate</th>
                  <th className="px-4 py-3">Allocated</th>
                  <th className="px-4 py-3">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {data.fundingBatches.length > 0 ? (
                  data.fundingBatches.map((batch) => (
                    <tr key={batch.id} className="border-t border-slate-100">
                      <td className="px-4 py-4">
                        <p className="font-bold">{batch.topupDate}</p>
                        <p className="max-w-48 truncate text-xs text-slate-500">{batch.reference ?? "No reference"}</p>
                      </td>
                      <td className="px-4 py-4">{batch.usdCredited.toFixed(4)} USDT</td>
                      <td className="px-4 py-4">{formatMyr(batch.myrSpent + batch.feesMyr)}</td>
                      <td className="px-4 py-4">RM {batch.effectiveRate.toFixed(4)}</td>
                      <td className="px-4 py-4">{batch.allocatedUsd.toFixed(4)} USDT</td>
                      <td className="px-4 py-4 font-bold">{batch.remainingUsd.toFixed(4)} USDT</td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-t border-slate-100">
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                      No funding batches recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="font-display text-3xl font-bold">Recent paid orders</h2>
          <p className="mt-1 text-sm text-slate-500">Orders without allocation are waiting for funding balance or cost data.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Revenue</th>
                <th className="px-4 py-3">Cost</th>
                <th className="px-4 py-3">Net</th>
                <th className="px-4 py-3">Profit status</th>
              </tr>
            </thead>
            <tbody>
              {data.recentOrders.length > 0 ? (
                data.recentOrders.map((order) => (
                  <tr key={order.id} className="border-t border-slate-100">
                    <td className="px-4 py-4">
                      <p className="font-bold">{order.orderNumber}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(order.paidAt)}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="max-w-72 break-words font-semibold">{order.productTitle ?? "Product"}</p>
                      <p className="max-w-72 break-words text-xs text-slate-500">{order.variationTitle ?? "Variation"}</p>
                    </td>
                    <td className="px-4 py-4 capitalize">{order.status}</td>
                    <td className="px-4 py-4">{formatMyr(order.amountMyr)}</td>
                    <td className="px-4 py-4">
                      <p>{formatMyr(order.costMyr)}</p>
                      <p className="text-xs text-slate-500">{order.costUsd.toFixed(4)} USDT</p>
                    </td>
                    <td className="px-4 py-4">{order.netProfitMyr === null ? "Pending" : formatMyr(order.netProfitMyr)}</td>
                    <td className="px-4 py-4">
                      {order.profitAllocatedAt ? (
                        <span className="rounded-md bg-emerald-50 px-2 py-1 font-bold text-emerald-700">Allocated</span>
                      ) : (
                        <span className="rounded-md bg-amber-50 px-2 py-1 font-bold text-amber-700">Pending</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="border-t border-slate-100">
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={7}>
                    No paid orders found yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof CircleDollarSign;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <Icon className="mb-5 h-5 w-5 text-sky-600" />
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <strong className="mt-2 block break-words text-3xl">{value}</strong>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "amber" | "emerald";
}) {
  const toneClass =
    tone === "amber"
      ? "bg-amber-50 text-amber-800"
      : tone === "emerald"
        ? "bg-emerald-50 text-emerald-800"
        : "bg-slate-50 text-slate-900";

  return (
    <div className={`rounded-md p-4 ${toneClass}`}>
      <p className="text-xs font-bold uppercase opacity-75">{label}</p>
      <strong className="mt-1 block break-words text-xl">{value}</strong>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  placeholder,
  defaultValue,
  required = true,
  step,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  step?: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-slate-700">
      {label}
      <input
        name={name}
        type={type}
        step={step ?? (type === "number" ? "0.01" : undefined)}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="rounded-md border border-slate-200 px-3 py-3"
      />
    </label>
  );
}

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatMyr(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date(value));
}
