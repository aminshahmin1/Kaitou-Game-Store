"use client";

import { useState } from "react";
import { Loader2, RefreshCw, Save } from "lucide-react";

import type { AdminOrder } from "@/lib/admin-orders";

type Draft = {
  status: AdminOrder["status"];
  supportNotes: string;
  failureReason: string;
  refundReference: string;
};

const statusOptions: Array<[AdminOrder["status"], string]> = [
  ["review", "Review"],
  ["processing", "Processing"],
  ["completed", "Completed"],
  ["failed", "Failed"],
  ["refunded", "Refunded"],
];

export function AdminReviewQueue({ initialOrders }: { initialOrders: AdminOrder[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => createDrafts(initialOrders));
  const [isLoading, setIsLoading] = useState(false);
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadOrders() {
    setIsLoading(true);
    setMessage(null);

    const response = await fetch("/api/admin/orders");
    const body = await response.json().catch(() => ({}));
    setIsLoading(false);

    if (!response.ok) {
      setMessage(body.error ?? "Review orders could not be loaded.");
      return;
    }

    const nextOrders = body.orders ?? [];
    setOrders(nextOrders);
    setDrafts(createDrafts(nextOrders));
  }

  async function saveOrder(order: AdminOrder) {
    const draft = drafts[order.id];

    if (!draft) {
      return;
    }

    setSavingOrderId(order.id);
    setMessage(null);

    const response = await fetch(`/api/admin/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const body = await response.json().catch(() => ({}));
    setSavingOrderId(null);

    if (!response.ok) {
      setMessage(body.error ?? "Order could not be updated.");
      return;
    }

    setMessage(`${order.orderNumber} updated.`);
    await loadOrders();
  }

  function updateDraft(orderId: string, patch: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [orderId]: {
        ...current[orderId],
        ...patch,
      },
    }));
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-200 p-5 md:flex-row md:items-center">
        <div>
          <h2 className="font-display text-3xl font-bold">Failed order review</h2>
          <p className="text-sm text-slate-500">
            Review paid fulfillment issues, record support notes, and move orders to the right final status.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex min-h-10 items-center rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
            {orders.length} in queue
          </span>
          <button
            type="button"
            onClick={() => void loadOrders()}
            disabled={isLoading}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
        </div>
      </div>

      {message ? (
        <div className="m-5 rounded-md border border-sky-100 bg-sky-50 p-3 text-sm font-semibold text-sky-800">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 p-5">
        {orders.length > 0 ? (
          orders.map((order) => {
            const draft = drafts[order.id] ?? createDraft(order);

            return (
              <article key={order.id} className="grid gap-4 rounded-lg border border-slate-200 p-4">
                <div className="grid gap-4 xl:grid-cols-[1fr_1fr_220px]">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase text-slate-500">Order</p>
                    <h3 className="break-words font-display text-2xl font-bold">{order.orderNumber}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatDateTime(order.updatedAt)} / {formatMyr(order.amountMyr)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase text-slate-500">Customer</p>
                    <p className="break-words font-bold">{order.customerName}</p>
                    <p className="break-all text-sm text-slate-500">{order.customerEmail}</p>
                    <p className="break-all text-sm text-slate-500">{order.customerWhatsapp}</p>
                  </div>
                  <label className="grid gap-1 text-sm font-semibold text-slate-700">
                    Status
                    <select
                      value={draft.status}
                      onChange={(event) => updateDraft(order.id, { status: event.target.value as AdminOrder["status"] })}
                      className="rounded-md border border-slate-200 px-3 py-3"
                    >
                      {statusOptions.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid gap-3 rounded-md bg-slate-50 p-4 text-sm md:grid-cols-2">
                  <Info label="Product" value={`${order.productTitle ?? "Product"} / ${order.variationTitle ?? "Variation"}`} />
                  <Info label="Payment reference" value={order.paymentReference ?? "No reference"} />
                  <Info label="Fulfillment reference" value={order.fulfillmentReference ?? "No reference"} />
                  <Info label="Customer fields" value={formatCustomerFields(order.customerFields)} />
                </div>

                <div className="grid gap-3 lg:grid-cols-3">
                  <label className="grid gap-1 text-sm font-semibold text-slate-700 lg:col-span-2">
                    Failure reason
                    <input
                      value={draft.failureReason}
                      onChange={(event) => updateDraft(order.id, { failureReason: event.target.value })}
                      className="rounded-md border border-slate-200 px-3 py-3"
                      placeholder="Reason shown internally for support"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-slate-700">
                    Refund reference
                    <input
                      value={draft.refundReference}
                      onChange={(event) => updateDraft(order.id, { refundReference: event.target.value })}
                      className="rounded-md border border-slate-200 px-3 py-3"
                      placeholder="Optional"
                    />
                  </label>
                </div>

                <label className="grid gap-1 text-sm font-semibold text-slate-700">
                  Support notes
                  <textarea
                    value={draft.supportNotes}
                    onChange={(event) => updateDraft(order.id, { supportNotes: event.target.value })}
                    className="min-h-24 rounded-md border border-slate-200 px-3 py-3"
                    placeholder="What happened, customer contact summary, next action, refund status..."
                  />
                </label>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void saveOrder(order)}
                    disabled={savingOrderId === order.id}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {savingOrderId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save review
                  </button>
                </div>
              </article>
            );
          })
        ) : (
          <div className="rounded-md border border-dashed border-slate-200 p-8 text-center text-sm font-semibold text-slate-500">
            No failed, review, or refunded orders are waiting here.
          </div>
        )}
      </div>
    </section>
  );
}

function createDrafts(orders: AdminOrder[]) {
  return Object.fromEntries(orders.map((order) => [order.id, createDraft(order)]));
}

function createDraft(order: AdminOrder): Draft {
  return {
    status: order.status,
    supportNotes: order.supportNotes ?? "",
    failureReason: order.failureReason ?? "",
    refundReference: order.refundReference ?? "",
  };
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function formatCustomerFields(fields: Record<string, string>) {
  const entries = Object.entries(fields);

  if (entries.length === 0) {
    return "No extra fields";
  }

  return entries.map(([key, value]) => `${key}: ${value}`).join(" / ");
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
