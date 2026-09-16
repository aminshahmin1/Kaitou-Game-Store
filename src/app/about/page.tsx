import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Headphones, MessageCircle, ShieldCheck, Zap } from "lucide-react";

import { SiteHeader } from "@/components/site-header";

const trustPoints = [
  {
    title: "Malaysia-first checkout",
    copy: "Kaitou starts with MYR pricing and payment through ToyyibPay Standard before expanding to Indonesia and Southeast Asia.",
    icon: ShieldCheck,
  },
  {
    title: "Fast digital delivery",
    copy: "Paid orders are designed to move straight into processing through FazerCards fulfillment where supported.",
    icon: Zap,
  },
  {
    title: "Support review SOP",
    copy: "Failed orders are moved into review so support can retry, contact the customer, fulfill manually, or process refund steps.",
    icon: Headphones,
  },
];

export const metadata = {
  title: "About | Kaitou Game Store",
  description: "About Kaitou Game Store, Malaysia-first game top-ups and Steam gift games.",
};

export default function AboutPage() {
  return (
    <div className="kaitou-shell blue-grid">
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden border-b border-cyan-300/15">
          <div className="absolute inset-0 opacity-25">
            <Image
              src="/brand/facebook-cover-current.png"
              alt=""
              fill
              priority
              className="object-cover"
              sizes="100vw"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-[#030817] via-[#030817]/92 to-[#030817]/62" />
          <div className="relative mx-auto grid min-h-[520px] w-full max-w-7xl items-center gap-10 px-5 py-16 lg:grid-cols-[1fr_0.72fr]">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-md border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-sm font-bold text-cyan-100">
                <BadgeCheck className="h-4 w-4" />
                Kaitou Game Store
              </div>
              <h1 className="font-display text-6xl font-bold uppercase leading-[0.9] text-white text-balance md:text-8xl">
                Gaming energy. Clean checkout.
              </h1>
              <p className="mt-6 max-w-2xl text-lg font-medium leading-8 text-slate-200">
                Kaitou Game Store is built for players who want game top-ups and Steam
                gift games with fast delivery, clear MYR pricing, and a support process
                that treats every paid order seriously.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/#products"
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

            <div className="rounded-lg border border-cyan-300/20 bg-black/42 p-5 shadow-2xl shadow-black/30 backdrop-blur">
              <Image
                src="/brand/logo-current.png"
                alt="Kaitou Game Store logo"
                width={420}
                height={420}
                className="mx-auto aspect-square w-full max-w-[340px] rounded-full object-cover"
              />
              <div className="mt-5 rounded-md border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm font-medium leading-6 text-cyan-50">
                Kaitou keeps the shopping experience bold and gaming-first, while checkout,
                receipts, order lookup, and support stay clean so every customer can follow
                their payment and order clearly.
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-7xl gap-5 px-5 py-14 lg:grid-cols-3">
          {trustPoints.map((point) => (
            <article key={point.title} className="rounded-lg border border-cyan-300/20 bg-white/[0.045] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.22)]">
              <span className="grid h-12 w-12 place-items-center rounded-md bg-cyan-300 text-slate-950">
                <point.icon className="h-5 w-5" />
              </span>
              <h2 className="mt-5 font-display text-3xl font-bold uppercase leading-none text-white">
                {point.title}
              </h2>
              <p className="mt-3 text-sm font-medium leading-6 text-slate-300">{point.copy}</p>
            </article>
          ))}
        </section>

        <section className="trust-surface">
          <div className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-14 lg:grid-cols-[0.76fr_1fr]">
            <div>
              <p className="text-sm font-bold uppercase text-sky-600">How Kaitou handles orders</p>
              <h2 className="mt-2 font-display text-5xl font-bold leading-none text-slate-950">
                Built around paid-order clarity.
              </h2>
            </div>
            <div className="grid gap-3">
              {[
                "Unpaid or incomplete checkout does not trigger customer messages.",
                "Paid orders move into Processing automatically.",
                "Successful fulfillment becomes Completed.",
                "Fulfillment issues move to Failed, then Review for support action.",
                "Refunded is used only after refund handling is recorded.",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-lg border border-sky-100 bg-white p-4 text-sm font-semibold text-slate-700">
                  <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
