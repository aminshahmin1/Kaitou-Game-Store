import Link from "next/link";
import { ArrowRight, BadgeCheck } from "lucide-react";

import { formatMyr, getProductStartingPrice } from "@/lib/catalog";
import type { Product } from "@/lib/types";
import { ProductPoster } from "./product-poster";
import { CurrencyRain } from "./currency-rain";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="topup-product-card group overflow-hidden rounded-lg border border-cyan-300/20 bg-white/[0.045] shadow-[0_18px_45px_rgba(0,0,0,0.22)] transition hover:-translate-y-1 hover:border-cyan-300/50"
    >
      <div className="relative isolate overflow-hidden">
        {product.type === "topup" && <CurrencyRain game={product.game} />}
        <ProductPoster src={product.imageUrl} title={product.game} />
      </div>
      <div data-dark-surface className="bg-[#071225] p-5">
        <div className="flex items-center justify-between">
          <span className="rounded-md bg-black/35 px-3 py-1 text-xs font-bold uppercase text-cyan-100">
            {product.category}
          </span>
          <span className="rounded-md bg-cyan-300 px-3 py-1 text-xs font-black text-slate-950">
            {product.region}
          </span>
        </div>
        <div className="mt-4">
          <p className="text-sm font-semibold text-cyan-100/80">{product.game}</p>
          <h3 className="break-words font-display text-xl font-bold leading-snug text-white">
            {product.title}
          </h3>
        </div>
      </div>

      <div className="grid gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-400">{product.deliveryType}</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {product.available ? `From ${formatMyr(getProductStartingPrice(product))}` : "Temporarily out of stock"}
            </p>
          </div>
          <span className={`flex items-center gap-1 text-xs font-bold ${product.available ? "text-emerald-300" : "text-slate-300"}`}>
            <BadgeCheck className="h-4 w-4" />
            {product.available ? "Available" : "Out of stock"}
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-cyan-300/15 pt-4 text-sm font-bold text-cyan-100">
          {product.available ? "Buy now" : "View options"}
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
}
