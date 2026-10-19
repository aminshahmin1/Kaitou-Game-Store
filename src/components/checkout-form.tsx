"use client";

import { useRef, useState } from "react";
import { Loader2, LockKeyhole, MessageCircle } from "lucide-react";

import { formatMyr } from "@/lib/catalog";
import type { CheckoutResult } from "@/lib/types";
import type { CheckoutProduct } from "@/lib/checkout-product";
import { getCheckoutPricing } from "@/lib/checkout-pricing";
import { normalizeSteamInvite } from "@/lib/steam-pricing";
import { SteamInviteHelp } from "./steam-invite-help";

export function CheckoutForm({ product, launchTest = false, purchaseAvailable = true }: { product: CheckoutProduct; launchTest?: boolean; purchaseAvailable?: boolean }) {
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [variationId, setVariationId] = useState((product.steamGift ? product.variations.find((v) => v.active && v.region === "MY") : product.variations.find((v) => v.active && v.available) ?? product.variations.find((v) => v.active))?.id ?? "");
  const [edition, setEdition] = useState((product.variations.find((v) => v.active && v.region === "MY") ?? product.variations.find((v) => v.active))?.edition ?? product.variations[0]?.title ?? "");
  const [review, setReview] = useState<FormData | null>(null);
  const confirmation = useRef<HTMLDialogElement>(null);
  const chosen = product.variations.find((v) => v.id === variationId);
  const editions = [...new Set(product.variations.filter((v) => v.active).map((v) => v.edition ?? v.title))];
  const selected = product.variations.find((v) => v.id === variationId && v.active && v.available);
  const pricing = chosen ? getCheckoutPricing(chosen.priceMyr) : null;
  const canPurchase = purchaseAvailable && Boolean(selected);

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
      ...(product.steamGift && selected ? { expectedPriceMyr: selected.priceMyr } : {}),
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
    <form onSubmit={(event) => {
      event.preventDefault();
      if (isSubmitting || review || !canPurchase) return;
      const data = new FormData(event.currentTarget);
      if (product.steamGift) {
        try { data.set("steam_invite_url", normalizeSteamInvite(String(data.get("steam_invite_url") ?? ""))); }
        catch { setError("Use your Steam friend invite link starting with https://s.team/p/."); return; }
        setReview(data); confirmation.current?.showModal();
      } else void onSubmit(data);
    }} onChange={() => { if (result) setResult(null); }} className="trust-surface grid gap-5 rounded-lg border border-sky-100 p-5 shadow-2xl shadow-sky-950/20 md:p-6">
      <div className="flex items-start justify-between gap-4 border-b border-sky-100 pb-5">
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase text-sky-600">Secure checkout</p>
          <h2 className="mt-1 break-words font-display text-3xl font-bold text-slate-950">{product.title}</h2>
        </div>
        <div data-dark-surface className="shrink-0 rounded-md bg-slate-950 px-3 py-2 text-right text-white">
          <span className="block text-xs text-cyan-200">{product.steamGift ? "Game price" : "From"}</span>
          <strong>{product.steamGift ? chosen ? formatMyr(chosen.priceMyr) : "Choose region" : formatMyr(Math.min(...product.variations.filter((v) => v.active && v.available).map((variation) => variation.priceMyr)))}</strong>
        </div>
      </div>

      {product.steamGift && <label className="grid min-w-0 gap-2 text-sm font-semibold text-slate-700">Edition
        <select disabled={isSubmitting || Boolean(review)} value={edition} required
          onChange={(event) => { const value=event.target.value; setEdition(value); const matches = product.variations.filter((v) => v.active && (v.edition ?? v.title) === value); setVariationId(matches.find((v) => v.region === (chosen?.region ?? "MY"))?.id ?? ""); }}
          className="min-w-0 w-full rounded-md border border-sky-100 bg-white px-3 py-3 text-slate-950">
          {editions.map((edition) => <option key={edition} value={edition}>{edition}</option>)}
        </select>
      </label>}
      <label className="grid min-w-0 gap-2 text-sm font-semibold text-slate-700">
        {product.steamGift ? "Receiving Steam account region" : "Select product"}
        <select
          name="variationId"
          value={variationId}
          onChange={(event) => setVariationId(event.target.value)}
          required
          disabled={isSubmitting || Boolean(review)}
          className="min-w-0 w-full rounded-md border border-sky-100 bg-white px-3 py-3 text-slate-950 outline-none ring-sky-300 transition focus:ring-4"
        >
          {product.steamGift && <option value="">Choose receiving account region</option>}
          {product.variations
            .filter((variation) => variation.active && (!product.steamGift || (variation.edition ?? variation.title) === edition))
            .map((variation) => (
              <option key={variation.id} value={variation.id} disabled={!variation.available && !product.steamGift}>
                {product.steamGift ? regionName(variation.region ?? "") : variation.title} - {formatMyr(variation.priceMyr)}{!variation.available ? " (Out of stock)" : ""}
              </option>
            ))}
        </select>
      </label>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid min-w-0 gap-2 text-sm font-semibold text-slate-700">
          Name
          <input
            name="customerName"
            disabled={isSubmitting || Boolean(review)}
            required
            placeholder="Your name"
            className="min-w-0 w-full rounded-md border border-sky-100 bg-white px-3 py-3 text-slate-950 outline-none ring-sky-300 transition focus:ring-4"
          />
        </label>
        <label className="grid min-w-0 gap-2 text-sm font-semibold text-slate-700">
          Email
          <input
            name="customerEmail"
            disabled={isSubmitting || Boolean(review)}
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
            disabled={isSubmitting || Boolean(review)}
            required
            placeholder="Example: 0123456789"
            className="min-w-0 w-full rounded-md border border-sky-100 bg-white px-3 py-3 text-slate-950 outline-none ring-sky-300 transition focus:ring-4"
          />
        </label>
      </div>

      <input type="hidden" name="locale" value="en" />

      <div className="grid gap-4">
        {product.requiredFields.map((field) => (
          <label key={field.key} className="grid min-w-0 gap-2 text-sm font-semibold text-slate-700">
            <span className="flex items-center justify-between gap-3">{field.label}{product.steamGift && field.key === "steam_invite_url" && <SteamInviteHelp />}</span>
            {field.type === "select" ? (
              <select
                name={field.key}
                disabled={isSubmitting || Boolean(review)}
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
                disabled={isSubmitting || Boolean(review)}
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
        disabled={isSubmitting || !pricing || !canPurchase || Boolean(result) || Boolean(review)}
        className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-5 py-3 font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
        {!canPurchase ? "Temporarily out of stock" : pricing ? `${product.steamGift ? "Review" : "Pay"} ${formatMyr(pricing.totalMyr)}${product.steamGift ? " order" : " with FPX"}` : "Unavailable"}
      </button>
      {product.steamGift && !canPurchase && <p role="status" className="text-sm leading-6 text-slate-600">{chosen ? "This edition and region are temporarily out of stock. Check another edition or come back shortly." : "Choose the receiving account's region to check price and availability."} Only choose a region that matches your Steam account. No payment has been started.</p>}

      <p className="flex items-start gap-2 text-xs font-medium text-slate-500">
        <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
        After payment, track your purchase on the Order Status page using your order number and contact details.
      </p>
      {product.steamGift && <dialog ref={confirmation} onClose={() => setReview(null)} aria-labelledby="steam-confirm-title" className="ranking-promo m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-lg border border-slate-200 bg-white p-6 text-slate-950 shadow-2xl">
        <h3 id="steam-confirm-title" className="text-2xl font-bold">Review your Steam gift</h3>
        <p className="mt-3 text-sm leading-6 text-slate-600">Check the receiving account, region and edition before continuing to payment.</p>
        <dl className="mt-5 grid gap-4 border-y border-slate-200 py-5 text-sm">
          <div><dt className="text-slate-600">Game</dt><dd className="mt-1 font-semibold">{product.title}</dd></div>
          <div><dt className="text-slate-600">Edition</dt><dd className="mt-1 font-semibold">{chosen?.edition ?? chosen?.title}</dd></div>
          <div><dt className="text-slate-600">Region</dt><dd className="mt-1 font-semibold">{regionName(chosen?.region ?? "")}</dd></div>
          <div><dt className="text-slate-600">Steam invite link</dt><dd className="mt-1 break-all font-semibold">{String(review?.get("steam_invite_url") ?? "")}</dd></div>
          <div className="flex justify-between gap-4"><dt>Game price</dt><dd>{formatMyr(pricing?.subtotalMyr ?? 0)}</dd></div>
          <div className="flex justify-between gap-4"><dt>FPX fee</dt><dd>{formatMyr(pricing?.feeMyr ?? 0)}</dd></div>
          <div className="flex justify-between gap-4 font-bold"><dt>Total</dt><dd>{formatMyr(pricing?.totalMyr ?? 0)}</dd></div>
        </dl>
        <p className="mt-4 text-xs leading-6 text-slate-600">Link format checked. The receiving Steam profile has not been verified. Only continue if this link belongs to the correct account.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => confirmation.current?.close()} className="min-h-11 rounded-md border border-slate-300 px-4 py-3 font-semibold">Go back</button><button type="button" onClick={() => { const data = review; confirmation.current?.close(); if (data) void onSubmit(data); }} className="min-h-11 rounded-md bg-sky-800 px-4 py-3 font-semibold text-white">Continue to FPX</button></div>
      </dialog>}
    </form>
  );
}

function regionName(code: string) {
  // Fixed labels avoid server/browser ICU differences during hydration.
  const names: Record<string,string> = { AE:"United Arab Emirates", AR:"Argentina", AU:"Australia", BR:"Brazil", BY:"Belarus", CA:"Canada", CH:"Switzerland", CIS:"CIS", CL:"Chile", CN:"China", CO:"Colombia", CR:"Costa Rica", DE:"Germany", EURO:"Europe", GB:"United Kingdom", HK:"Hong Kong", ID:"Indonesia", IL:"Israel", IN:"India", JP:"Japan", KR:"South Korea", KW:"Kuwait", KZ:"Kazakhstan", LATAM:"Latin America", MENA:"Middle East and North Africa", MX:"Mexico", MY:"Malaysia", NO:"Norway", NZ:"New Zealand", PE:"Peru", PH:"Philippines", PK:"Pakistan", PL:"Poland", QA:"Qatar", RU:"Russia", SA:"Saudi Arabia", SASIA:"South Asia", SG:"Singapore", TH:"Thailand", TR:"Turkey", TW:"Taiwan", UA:"Ukraine", UK:"United Kingdom", US:"United States", UY:"Uruguay", VN:"Vietnam", ZA:"South Africa" };
  return names[code] ? `${names[code]} (${code})` : code || "Choose region";
}
