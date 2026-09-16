import Link from "next/link";
import { ArrowRight, BadgeCheck } from "lucide-react";

import { formatMyr, getProductStartingPrice } from "@/lib/catalog";
import type { Product } from "@/lib/types";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group overflow-hidden rounded-lg border border-cyan-300/20 bg-white/[0.045] shadow-[0_18px_45px_rgba(0,0,0,0.22)] transition hover:-translate-y-1 hover:border-cyan-300/50"
    >
      <div className={`min-h-44 bg-gradient-to-br ${product.imageTone} p-5`}>
        <div className="flex items-center justify-between">
          <span className="rounded-md bg-black/35 px-3 py-1 text-xs font-bold uppercase text-cyan-100">
            {product.category}
          </span>
          <span className="rounded-md bg-cyan-300 px-3 py-1 text-xs font-black text-slate-950">
            {product.region}
          </span>
        </div>
        <div className="mt-16">
          <p className="text-sm font-semibold text-cyan-100/80">{product.game}</p>
          <h3 className="font-display text-3xl font-bold uppercase leading-none text-white">
            {product.title}
          </h3>
        </div>
      </div>

      <div className="grid gap-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-400">{product.deliveryType}</p>
            <p className="mt-1 text-2xl font-bold text-white">
              From {formatMyr(getProductStartingPrice(product))}
            </p>
          </div>
          <span className="flex items-center gap-1 text-xs font-bold text-emerald-300">
            <BadgeCheck className="h-4 w-4" />
            Available
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-cyan-300/15 pt-4 text-sm font-bold text-cyan-100">
          Buy now
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
}
