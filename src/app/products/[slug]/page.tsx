import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, ShieldCheck } from "lucide-react";

import { CheckoutForm } from "@/components/checkout-form";
import { SiteHeader } from "@/components/site-header";
import { formatMyr, getProductStartingPrice } from "@/lib/catalog";
import { getStoreProductBySlug } from "@/lib/products";
import { toCheckoutProduct } from "@/lib/checkout-product";
import { ProductPoster } from "@/components/product-poster";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getStoreProductBySlug(slug);

  return {
    title: product ? `${product.title} | Kaitou Game Store` : "Product | Kaitou Game Store",
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getStoreProductBySlug(slug);

  if (!product) {
    notFound();
  }

  return (
    <div className="kaitou-shell blue-grid">
      <SiteHeader />
      <main className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-10 lg:grid-cols-[0.92fr_1.08fr]">
        <section className="grid content-start gap-6">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-cyan-100">
            <ArrowLeft className="h-4 w-4" />
            Back to products
          </Link>

          <div data-dark-surface className="overflow-hidden rounded-lg border border-cyan-300/20 bg-[#071225] shadow-2xl shadow-black/30">
            <ProductPoster src={product.imageUrl} title={product.game} priority />
            <div className="p-6">
            <div className="flex items-center justify-between">
              <span className="rounded-md bg-black/35 px-3 py-1 text-xs font-bold uppercase text-cyan-100">
                {product.category}
              </span>
              <span className="rounded-md bg-cyan-300 px-3 py-1 text-xs font-black text-slate-950">
                {product.region}
              </span>
            </div>
            <div className="mt-5">
              <p className="text-sm font-semibold text-cyan-100/80">{product.game}</p>
              <h1 className="break-words font-display text-3xl font-bold leading-tight text-white">
                {product.title}
              </h1>
              <p className="mt-4 max-w-md text-sm font-medium leading-6 text-slate-200">
                Choose a package and enter your game details. We will send an email update after payment and when your order is delivered.
              </p>
            </div>
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border border-cyan-300/20 bg-white/[0.045] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-semibold text-slate-300">Price</span>
              <strong className="text-2xl text-white">{product.available ? `From ${formatMyr(getProductStartingPrice(product))}` : "Out of stock"}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-300">Delivery</span>
              <strong className="text-cyan-100">{product.deliveryType}</strong>
            </div>
            <p className="text-sm text-slate-300">A separate RM1.00 FPX payment fee applies per order. The full total is shown before payment.</p>
            <div className="flex items-center gap-2 border-t border-cyan-300/15 pt-3 text-sm font-bold text-emerald-300">
              <BadgeCheck className="h-4 w-4" />
              {product.available ? "Available" : "Temporarily out of stock"}
            </div>
          </div>
        </section>

        <section className="grid content-start gap-4">
          <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm font-medium leading-6 text-cyan-50">
            <div className="mb-1 flex items-center gap-2 font-bold">
              <ShieldCheck className="h-4 w-4" />
              Check your game details
            </div>
            Make sure your player ID, server, and region match your game account before paying.
          </div>
          {process.env.CHECKOUT_ENABLED === "true" && product.available ? (
            <CheckoutForm product={toCheckoutProduct(product)} />
          ) : (
            <div className="trust-surface border border-sky-100 p-6 text-slate-700">
              <h2 className="text-lg font-bold text-slate-950">Packages</h2>
              <ul className="mt-3 divide-y divide-sky-100">
                {product.variations.filter((variation) => variation.active).map((variation) => (
                  <li key={variation.id} className="flex min-w-0 items-start justify-between gap-4 py-3">
                    <span className="min-w-0 break-words text-sm font-semibold">
                      {variation.title}
                      {!variation.available && <span className="mt-1 block text-xs font-normal text-slate-500">Out of stock</span>}
                    </span>
                    <strong className="shrink-0 text-sm tabular-nums">{formatMyr(variation.priceMyr)}</strong>
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-sky-100 pt-4 text-sm">
                {product.available ? "Checkout is temporarily unavailable. Please check back soon." : "Temporarily out of stock. Please check back soon."}
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
