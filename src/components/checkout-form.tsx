"use client";

import { useState } from "react";
import { Loader2, LockKeyhole, MessageCircle } from "lucide-react";

import { formatMyr } from "@/lib/catalog";
import type { CheckoutResult } from "@/lib/types";
import type { CheckoutProduct } from "@/lib/checkout-product";
import { getCheckoutPricing } from "@/lib/checkout-pricing";

export function CheckoutForm({ product, launchTest = false }: { product: CheckoutProduct; launchTest?: boolean }) {
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [variationId, setVariationId] = useState(product.variations.find((v) => v.active && v.available)?.id ?? "");
  const selected = product.variations.find((v) => v.id === variationId && v.active && v.available);
  const pricing = selected ? getCheckoutPricing(selected.priceMyr) : null;

  async function onSubmit(formData: FormData) {
    setIsSubmitting(true);
    setError(null);
    setResult(null);

    const fieldValues = Object.fromEntries(
      product.requiredFields.map((field) => [field.key, String(formData.get(field.key) ?? "")]),
    );

    const payload = {
      ...(launchTest ? { launchTest: true } : {}),
      productSlug: product.slug,
      variationId: String(formData.get("variationId") ?? ""),
      customerName: String(formData.get("customerName") ?? ""),
      customerEmail: String(formData.get("customerEmail") ?? ""),
      whatsapp: String(formData.get("whatsapp") ?? ""),
      locale: String(formData.get("locale") ?? "en"),
      fieldValues,
    };

    try {
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = await response.json();

    if (!response.ok) {
      setError(body.error ?? "Checkout could not be started.");
      return;
    }

    setResult(body);
    } catch {
      setError("Connection failed. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form action={onSubmit} onChange={() => { if (result) setResult(null); }} className="trust-surface grid gap-5 rounded-lg border border-sky-100 p-5 shadow-2xl shadow-sky-950/20 md:p-6">
      <div className="flex items-start justify-between gap-4 border-b border-sky-100 pb-5">
        <div>
          <p className="text-sm font-bold uppercase text-sky-600">Secure checkout</p>
          <h2 className="mt-1 break-words font-display text-3xl font-bold text-slate-950">{product.title}</h2>
        </div>
        <div data-dark-surface className="shrink-0 rounded-md bg-slate-950 px-3 py-2 text-right text-white">
          <span className="block text-xs text-cyan-200">From</span>
          <strong>{formatMyr(Math.min(...product.variations.filter((v) => v.active && v.available).map((variation) => variation.priceMyr)))}</strong>
        </div>
      </div>

      <label className="grid min-w-0 gap-2 text-sm font-semibold text-slate-700">
        Select product
        <select
          name="variationId"
          value={variationId}
          onChange={(event) => setVariationId(event.target.value)}
          required
          className="min-w-0 w-full rounded-md border border-sky-100 bg-white px-3 py-3 text-slate-950 outline-none ring-sky-300 transition focus:ring-4"
        >
          {product.variations
            .filter((variation) => variation.active)
            .map((variation) => (
              <option key={variation.id} value={variation.id} disabled={!variation.available}>
                {variation.title} - {formatMyr(variation.priceMyr)}{!variation.available ? " (Out of stock)" : ""}
              </option>
            ))}
        </select>
      </label>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid min-w-0 gap-2 text-sm font-semibold text-slate-700">
          Name
          <input
            name="customerName"
            required
            placeholder="Your name"
            className="min-w-0 w-full rounded-md border border-sky-100 bg-white px-3 py-3 text-slate-950 outline-none ring-sky-300 transition focus:ring-4"
          />
        </label>
        <label className="grid min-w-0 gap-2 text-sm font-semibold text-slate-700">
          Email
          <input
            name="customerEmail"
            type="email"
            required
            placeholder="you@example.com"
            className="min-w-0 w-full rounded-md border border-sky-100 bg-white px-3 py-3 text-slate-950 outline-none ring-sky-300 transition focus:ring-4"
          />
        </label>
        <label className="grid min-w-0 gap-2 text-sm font-semibold text-slate-700">
          WhatsApp number
          <input
            name="whatsapp"
            required
            placeholder="Example: 0172637043"
            className="min-w-0 w-full rounded-md border border-sky-100 bg-white px-3 py-3 text-slate-950 outline-none ring-sky-300 transition focus:ring-4"
          />
        </label>
      </div>

      <input type="hidden" name="locale" value="en" />

      <div className="grid gap-4">
        {product.requiredFields.map((field) => (
          <label key={field.key} className="grid min-w-0 gap-2 text-sm font-semibold text-slate-700">
            {field.label}
            {field.type === "select" ? (
              <select
                name={field.key}
                required
                className="min-w-0 w-full rounded-md border border-sky-100 bg-white px-3 py-3 text-slate-950 outline-none ring-sky-300 transition focus:ring-4"
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
                type="text"
                inputMode={field.type === "number" ? "numeric" : undefined}
                pattern={field.type === "number" ? "[0-9]+" : undefined}
                maxLength={1000}
                placeholder={field.placeholder}
                className="min-w-0 w-full rounded-md border border-sky-100 bg-white px-3 py-3 text-slate-950 outline-none ring-sky-300 transition focus:ring-4"
              />
            )}
            {field.help ? <span className="text-xs font-medium text-slate-500">{field.help}</span> : null}
          </label>
        ))}
      </div>

      {error ? (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <strong className="block">Payment link created for order {result.orderId}.</strong>
          {result.expiresAt && <p className="mt-1">Pay before {new Intl.DateTimeFormat("en-MY", { timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", minute: "2-digit", hour12: true }).format(new Date(result.expiresAt))} MYT.</p>}
          {result.paymentSetupRequired ? "Payment setup is not active yet. This order was not charged." : "Continue to ToyyibPay."}
          <a
            href={result.paymentUrl}
            data-dark-surface
            className="mt-3 inline-flex rounded-md bg-emerald-700 px-4 py-2 text-sm font-bold text-white"
          >
            Continue payment
          </a>
        </div>
      ) : null}

      {pricing && <dl className="grid gap-2 border-t border-sky-100 pt-4 text-sm text-slate-700" aria-live="polite">
        <div className="flex justify-between gap-4"><dt>Product subtotal</dt><dd>{formatMyr(pricing.subtotalMyr)}</dd></div>
        <div className="flex justify-between gap-4"><dt>FPX payment fee</dt><dd>{formatMyr(pricing.feeMyr)}</dd></div>
        <div className="flex justify-between gap-4 text-lg font-bold text-slate-950"><dt>Total payable</dt><dd>{formatMyr(pricing.totalMyr)}</dd></div>
      </dl>}

      <button
        data-dark-surface
        type="submit"
        disabled={isSubmitting || !pricing || Boolean(result)}
        className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-5 py-3 font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
        {pricing ? `Pay ${formatMyr(pricing.totalMyr)} with FPX` : "Unavailable"}
      </button>

      <p className="flex items-start gap-2 text-xs font-medium text-slate-500">
        <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
        After payment, track your purchase on the Order Status page using your order number and contact details.
      </p>
    </form>
  );
}
