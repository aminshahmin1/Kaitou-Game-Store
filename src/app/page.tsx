import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { BadgeCheck, Gamepad2, Gauge, ShieldCheck, Sparkles, Zap } from "lucide-react";

import { ProductCard } from "@/components/product-card";
import { SiteHeader } from "@/components/site-header";
import { getStoreProducts } from "@/lib/products";
import { RankingPromotion } from "@/components/ranking-promotion";

const categories = [
  { label: "Game Top-Ups", value: "Delivered to your game account", icon: Zap },
  { label: "Steam Gift Games", value: "Games sent directly to your Steam account", icon: Gamepad2 },
  { label: "MYR Checkout", value: "Secure payment with clear order tracking", icon: ShieldCheck },
];

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  await connection();
  const filters = await searchParams;
  const query = typeof filters.q === "string" ? filters.q.trim().slice(0, 100).toLowerCase() : "";
  const products = (await getStoreProducts()).filter((p) =>
    (!query || `${p.title} ${p.game} ${p.category}`.toLowerCase().includes(query))
    && (!filters.category || p.type === filters.category));

  return (
    <div className="kaitou-shell blue-grid">
      <SiteHeader />
      <RankingPromotion />
      <main>
        <section data-dark-surface className="relative overflow-hidden border-b border-cyan-300/15 bg-[#030817] text-white">
          <div className="absolute inset-0 opacity-35">
            <Image
              src="/brand/logo-current.png"
              alt=""
              fill
              priority
              className="object-cover"
              sizes="100vw"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-[#030817] via-[#030817]/86 to-[#030817]/35" />
          <div className="relative mx-auto grid w-full max-w-7xl items-center px-5 py-10 lg:min-h-[420px] lg:grid-cols-[1.04fr_0.96fr] lg:gap-10">
            <div className="max-w-3xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-md border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-sm font-bold text-cyan-100">
                <Sparkles className="h-4 w-4" />
                Malaysia-first game top-ups and Steam gift games
              </div>
              <h1 className="font-display text-5xl font-bold uppercase leading-none text-white text-balance md:text-7xl">
                Kaitou Game Store
              </h1>
              <p className="mt-6 max-w-2xl text-lg font-medium leading-8 text-slate-200">
                Buy game top-ups and Steam gift games with clear MYR pricing,
                secure FPX payment, and help from our support team.
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
            <div className="hidden gap-3 lg:grid">
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

          <form action="/#products" className="flex flex-wrap items-end gap-3">
            <label className="grid min-w-0 flex-1 gap-1 text-sm">Search products
              <input name="q" defaultValue={filters.q ?? ""} maxLength={100} className="min-w-0 rounded-md border border-cyan-300/30 bg-white px-3 py-3 text-slate-950" placeholder="Game name" />
            </label>
            <label className="grid gap-1 text-sm">Category
              <select name="category" defaultValue={filters.category ?? ""} className="rounded-md border border-cyan-300/30 bg-white px-3 py-3 text-slate-950">
                <option value="">All products</option><option value="topup">Game top-ups</option><option value="steam_gift_game">Steam gift games</option>
              </select>
            </label>
            <button type="submit" className="min-h-12 rounded-md bg-cyan-300 px-4 py-3 font-bold text-slate-950">Search</button>
          </form>

          {products.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-cyan-300/20 bg-white/[0.045] p-8 text-center text-slate-200">
              {query || filters.category ? "No products match your search." : "Products are being prepared. Please check back soon."}
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
