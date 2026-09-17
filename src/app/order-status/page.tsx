import { MessageCircle } from "lucide-react";

import { OrderStatusLookup } from "@/components/order-status-lookup";
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

          <OrderStatusLookup />

          <div className="mt-6 flex items-start gap-3 rounded-md bg-sky-50 p-4 text-sm text-slate-600">
            <MessageCircle className="mt-0.5 h-4 w-4 text-sky-600" />
            WhatsApp updates are sent for paid orders when the status changes or support needs to contact you.
          </div>
        </section>
      </main>
    </div>
  );
}
