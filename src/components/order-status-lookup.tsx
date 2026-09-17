"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, Search } from "lucide-react";

import { formatMyr } from "@/lib/catalog";
import type { OrderStatus } from "@/lib/types";

type LookupResult = {
  orderNumber: string;
  status: OrderStatus;
  productTitle: string | null;
  variationTitle: string | null;
  amountMyr: number;
  updatedAt: string;
  failureReason: string | null;
};

const statusCopy: Record<OrderStatus, { label: string; body: string; tone: string }> = {
  processing: {
    label: "Processing",
    body: "Your payment is confirmed and the order is being fulfilled.",
    tone: "border-sky-200 bg-sky-50 text-sky-800",
  },
  completed: {
    label: "Completed",
    body: "Your order has been completed.",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  failed: {
    label: "Failed",
    body: "The order could not be completed automatically.",
    tone: "border-red-200 bg-red-50 text-red-800",
  },
  review: {
    label: "Review",
    body: "Support is reviewing the order before the next action.",
    tone: "border-amber-200 bg-amber-50 text-amber-800",
  },
  refunded: {
    label: "Refunded",
    body: "This order has been refunded.",
    tone: "border-slate-200 bg-slate-50 text-slate-700",
  },
};

function StatusIcon({ status }: { status: OrderStatus }) {
  if (status === "completed") {
    return <CheckCircle2 className="h-5 w-5" />;
  }

  if (status === "failed" || status === "review") {
    return <AlertTriangle className="h-5 w-5" />;
  }

  return <Clock3 className="h-5 w-5" />;
}

export function OrderStatusLookup() {
  const [order, setOrder] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(formData: FormData) {
    setIsLoading(true);
    setError(null);
    setOrder(null);

    const response = await fetch("/api/order-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderNumber: String(formData.get("orderNumber") ?? ""),
        contact: String(formData.get("contact") ?? ""),
      }),
    });

    const body = await response.json();
    setIsLoading(false);

    if (!response.ok) {
      setError(body.error ?? "Order could not be found.");
      return;
    }

    setOrder(body.order);
  }

  return (
    <>
      <form action={onSubmit} className="mt-8 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Order ID
          <input
            name="orderNumber"
            required
            className="rounded-md border border-sky-100 px-3 py-3 outline-none ring-sky-300 focus:ring-4"
            placeholder="KGS-..."
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Email or WhatsApp
          <input
            name="contact"
            required
            className="rounded-md border border-sky-100 px-3 py-3 outline-none ring-sky-300 focus:ring-4"
            placeholder="you@example.com or 0172637043"
          />
        </label>
        <button
          disabled={isLoading}
          className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Check
        </button>
      </form>

      {error ? (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      {order ? (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-bold ${statusCopy[order.status].tone}`}>
            <StatusIcon status={order.status} />
            {statusCopy[order.status].label}
          </div>
          <h2 className="mt-4 font-display text-3xl font-bold text-slate-950">{order.orderNumber}</h2>
          <p className="mt-2 text-slate-600">{statusCopy[order.status].body}</p>
          <dl className="mt-5 grid gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="font-semibold text-slate-500">Product</dt>
              <dd className="mt-1 font-bold text-slate-950">
                {[order.productTitle, order.variationTitle].filter(Boolean).join(" - ")}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500">Amount</dt>
              <dd className="mt-1 font-bold text-slate-950">{formatMyr(order.amountMyr)}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500">Last updated</dt>
              <dd className="mt-1 font-bold text-slate-950">
                {new Date(order.updatedAt).toLocaleString("en-MY")}
              </dd>
            </div>
          </dl>
          {order.failureReason ? (
            <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm font-medium text-amber-800">
              {order.failureReason}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
