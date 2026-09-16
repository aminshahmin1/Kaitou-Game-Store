import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Gamepad2, Gauge, ShieldCheck, Sparkles, Zap } from "lucide-react";

import { ProductCard } from "@/components/product-card";
import { SiteHeader } from "@/components/site-header";
import { getStoreProducts } from "@/lib/products";

const categories = [
  { label: "Game Top-Ups", value: "Direct IDs, UID, server and zone forms", icon: Zap },
  { label: "Steam Gift Games", value: "Gift delivery through FazerCards", icon: Gamepad2 },
  { label: "MYR Checkout", value: "Secure payment with clear order tracking", icon: ShieldCheck },
];

export default async function Home() {
  const products = await getStoreProducts();

  return (
    <div className="kaitou-shell blue-grid">
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden border-b border-cyan-300/15">
          <div className="absolute inset-0 opacity-35">
            <Image
              src="/brand/facebook-cover-current.png"
              alt=""
              fill
              priority
              className="object-cover"
              sizes="100vw"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-[#030817] via-[#030817]/86 to-[#030817]/35" />
          <div className="relative mx-auto grid min-h-[620px] w-full max-w-7xl items-end px-5 py-16 lg:grid-cols-[1.04fr_0.96fr] lg:gap-10">
            <div className="max-w-3xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-md border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-sm font-bold text-cyan-100">
                <Sparkles className="h-4 w-4" />
                Malaysia-first game top-ups and Steam gift games
              </div>
              <h1 className="font-display text-6xl font-bold uppercase leading-[0.88] text-white text-balance md:text-8xl">
                Play more. Spend less.
              </h1>
              <p className="mt-6 max-w-2xl text-lg font-medium leading-8 text-slate-200">
                Buy game top-ups and Steam gift games with clear MYR pricing,
                secure checkout, and support review for paid orders that need extra help.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="#products"
                  className="inline-flex min-h-12 items-center justify-center rounded-md bg-cyan-300 px-6 py-3 font-black uppercase text-slate-950 shadow-[0_0_28px_rgba(0,213,255,0.38)]"
                >
                  Browse products
                </Link>
                <Link
                  href="/order-status"
                  className="inline-flex min-h-12 items-center justify-center rounded-md border border-cyan-300/30 bg-white/5 px-6 py-3 font-bold text-cyan-100"
                >
                  Check order status
                </Link>
              </div>
            </div>
            <div className="mt-10 grid gap-3 lg:mt-0">
              {categories.map((category) => (
                <div
                  key={category.label}
                  className="flex items-center gap-4 rounded-lg border border-cyan-300/20 bg-black/40 p-4 backdrop-blur"
                >
                  <span className="grid h-12 w-12 place-items-center rounded-md bg-cyan-300 text-slate-950">
                    <category.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-display text-2xl font-bold uppercase">{category.label}</p>
                    <p className="text-sm font-medium text-slate-300">{category.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-14" id="products">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-bold uppercase text-cyan-200">Available now</p>
              <h2 className="font-display text-5xl font-bold uppercase leading-none text-white">
                Products
              </h2>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-sm font-bold text-emerald-200">
              <BadgeCheck className="h-4 w-4" />
              Availability shown before checkout
            </div>
          </div>

          {products.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-cyan-300/20 bg-white/[0.045] p-8 text-center text-slate-200">
              Products are being prepared. Please check back soon.
            </div>
          )}
        </section>

        <section className="trust-surface">
          <div className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-14 lg:grid-cols-3">
            {[
              ["Secure payment", "Pay online through ToyyibPay with your order details clearly recorded."],
              ["Simple order updates", "Track clear statuses such as Processing, Completed, Review, or Refunded."],
              ["Support when needed", "If fulfillment needs attention, your paid order is reviewed by Kaitou support."],
            ].map(([title, copy]) => (
              <div key={title} className="rounded-lg border border-sky-100 bg-white p-5 shadow-sm">
                <Gauge className="mb-4 h-6 w-6 text-sky-600" />
                <h3 className="font-display text-2xl font-bold text-slate-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
