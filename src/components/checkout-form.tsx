"use client";

import { useState } from "react";
import { Loader2, LockKeyhole, MessageCircle } from "lucide-react";

import { formatMyr } from "@/lib/catalog";
import type { CheckoutResult, Product } from "@/lib/types";

export function CheckoutForm({ product }: { product: Product }) {
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(formData: FormData) {
    setIsSubmitting(true);
    setError(null);
    setResult(null);

    const fieldValues = Object.fromEntries(
      product.requiredFields.map((field) => [field.key, String(formData.get(field.key) ?? "")]),
    );

    const payload = {
      productSlug: product.slug,
      variationId: String(formData.get("variationId") ?? ""),
      customerName: String(formData.get("customerName") ?? ""),
      customerEmail: String(formData.get("customerEmail") ?? ""),
      whatsapp: String(formData.get("whatsapp") ?? ""),
      locale: String(formData.get("locale") ?? "en"),
      fieldValues,
    };

    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = await response.json();
    setIsSubmitting(false);

    if (!response.ok) {
      setError(body.error ?? "Checkout could not be started.");
      return;
    }

    setResult(body);
  }

  return (
    <form action={onSubmit} className="trust-surface grid gap-5 rounded-lg border border-sky-100 p-5 shadow-2xl shadow-sky-950/20 md:p-6">
      <div className="flex items-start justify-between gap-4 border-b border-sky-100 pb-5">
        <div>
          <p className="text-sm font-bold uppercase text-sky-600">Secure checkout</p>
          <h2 className="mt-1 font-display text-3xl font-bold text-slate-950">{product.title}</h2>
        </div>
        <div className="rounded-md bg-slate-950 px-3 py-2 text-right text-white">
          <span className="block text-xs text-cyan-200">From</span>
          <strong>{formatMyr(Math.min(...product.variations.map((variation) => variation.priceMyr)))}</strong>
        </div>
      </div>

      <label className="grid gap-2 text-sm font-semibold text-slate-700">
        Select product
        <select
          name="variationId"
          required
          className="rounded-md border border-sky-100 bg-white px-3 py-3 text-slate-950 outline-none ring-sky-300 transition focus:ring-4"
        >
          {product.variations
            .filter((variation) => variation.active && variation.available)
            .map((variation) => (
              <option key={variation.id} value={variation.id}>
                {variation.title} - {formatMyr(variation.priceMyr)}
              </option>
            ))}
        </select>
      </label>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Name
          <input
            name="customerName"
            required
            placeholder="Your name"
            className="rounded-md border border-sky-100 bg-white px-3 py-3 text-slate-950 outline-none ring-sky-300 transition focus:ring-4"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Email
          <input
            name="customerEmail"
            type="email"
            required
            placeholder="you@example.com"
            className="rounded-md border border-sky-100 bg-white px-3 py-3 text-slate-950 outline-none ring-sky-300 transition focus:ring-4"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          WhatsApp number
          <input
            name="whatsapp"
            required
            placeholder="Example: 0172637043"
            className="rounded-md border border-sky-100 bg-white px-3 py-3 text-slate-950 outline-none ring-sky-300 transition focus:ring-4"
          />
        </label>
      </div>

      <input type="hidden" name="locale" value="en" />

      <div className="grid gap-4">
        {product.requiredFields.map((field) => (
          <label key={field.key} className="grid gap-2 text-sm font-semibold text-slate-700">
            {field.label}
            {field.type === "select" ? (
              <select
                name={field.key}
                required
                className="rounded-md border border-sky-100 bg-white px-3 py-3 text-slate-950 outline-none ring-sky-300 transition focus:ring-4"
              >
                <option value="">{field.placeholder}</option>
                {field.options?.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                name={field.key}
                required
                type={field.type ?? "text"}
                placeholder={field.placeholder}
                className="rounded-md border border-sky-100 bg-white px-3 py-3 text-slate-950 outline-none ring-sky-300 transition focus:ring-4"
              />
            )}
            {field.help ? <span className="text-xs font-medium text-slate-500">{field.help}</span> : null}
          </label>
        ))}
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <strong className="block">Payment link created for order {result.orderId}.</strong>
          {result.paymentSetupRequired ? "Payment setup is not active yet. This order was not charged." : "Continue to ToyyibPay."}
          <a
            href={result.paymentUrl}
            className="mt-3 inline-flex rounded-md bg-emerald-700 px-4 py-2 text-sm font-bold text-white"
          >
            Continue payment
          </a>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-5 py-3 font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
        Pay securely with ToyyibPay
      </button>

      <p className="flex items-start gap-2 text-xs font-medium text-slate-500">
        <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
        After payment, your order moves into processing. We only send WhatsApp updates for paid orders.
      </p>
    </form>
  );
}
