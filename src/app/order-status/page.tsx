import { MessageCircle, Search } from "lucide-react";

import { SiteHeader } from "@/components/site-header";

export default function OrderStatusPage() {
  return (
    <div className="trust-surface min-h-screen">
      <SiteHeader />
      <main className="mx-auto grid min-h-[calc(100vh-80px)] w-full max-w-5xl place-items-center px-5 py-12">
        <section className="w-full rounded-lg border border-sky-100 bg-white p-6 shadow-xl shadow-sky-950/10 md:p-8">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase text-sky-600">Order lookup</p>
            <h1 className="mt-2 font-display text-5xl font-bold text-slate-950">
              Check your Kaitou order
            </h1>
            <p className="mt-4 text-slate-600">
              Enter your order ID and WhatsApp number to view the latest status for your paid order.
            </p>
          </div>

          <form className="mt-8 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Order ID
              <input className="rounded-md border border-sky-100 px-3 py-3 outline-none ring-sky-300 focus:ring-4" placeholder="KGS-..." />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              WhatsApp number
              <input className="rounded-md border border-sky-100 px-3 py-3 outline-none ring-sky-300 focus:ring-4" placeholder="0172637043" />
            </label>
            <button className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-5 py-3 font-bold text-white">
              <Search className="h-4 w-4" />
              Check
            </button>
          </form>

          <div className="mt-6 flex items-start gap-3 rounded-md bg-sky-50 p-4 text-sm text-slate-600">
            <MessageCircle className="mt-0.5 h-4 w-4 text-sky-600" />
            WhatsApp updates are sent for paid orders when the status changes or support needs to contact you.
          </div>
        </section>
      </main>
    </div>
  );
}
