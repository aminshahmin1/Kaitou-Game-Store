import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, ShieldCheck } from "lucide-react";

import { CheckoutForm } from "@/components/checkout-form";
import { SiteHeader } from "@/components/site-header";
import { formatMyr, getProductStartingPrice } from "@/lib/catalog";
import { getStoreProductBySlug } from "@/lib/products";

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

          <div className={`min-h-[420px] rounded-lg border border-cyan-300/20 bg-gradient-to-br ${product.imageTone} p-6 shadow-2xl shadow-black/30`}>
            <div className="flex items-center justify-between">
              <span className="rounded-md bg-black/35 px-3 py-1 text-xs font-bold uppercase text-cyan-100">
                {product.category}
              </span>
              <span className="rounded-md bg-cyan-300 px-3 py-1 text-xs font-black text-slate-950">
                {product.region}
              </span>
            </div>
            <div className="mt-48">
              <p className="text-sm font-semibold text-cyan-100/80">{product.game}</p>
              <h1 className="font-display text-5xl font-bold uppercase leading-none text-white">
                {product.title}
              </h1>
              <p className="mt-4 max-w-md text-sm font-medium leading-6 text-slate-200">
                Fill the required fields carefully. Paid orders are automatically moved
                into processing and reviewed by support if fulfillment fails.
              </p>
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border border-cyan-300/20 bg-white/[0.045] p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-300">Price</span>
              <strong className="text-2xl text-white">From {formatMyr(getProductStartingPrice(product))}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-300">Delivery</span>
              <strong className="text-cyan-100">{product.deliveryType}</strong>
            </div>
            <div className="flex items-center gap-2 border-t border-cyan-300/15 pt-3 text-sm font-bold text-emerald-300">
              <BadgeCheck className="h-4 w-4" />
              Available
            </div>
          </div>
        </section>

        <section className="grid content-start gap-4">
          <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm font-medium leading-6 text-cyan-50">
            <div className="mb-1 flex items-center gap-2 font-bold">
              <ShieldCheck className="h-4 w-4" />
              Clean payment mode
            </div>
            The checkout form uses a plain trust surface even though the store keeps Kaitou&apos;s gaming identity.
          </div>
          <CheckoutForm product={product} />
        </section>
      </main>
    </div>
  );
}
