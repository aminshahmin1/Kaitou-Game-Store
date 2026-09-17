import { AlertTriangle, Boxes, CircleDollarSign, KeyRound, Settings, Users } from "lucide-react";

import { formatMyr } from "@/lib/catalog";
import { getAdminProducts } from "@/lib/products";
import { AdminLogoutButton } from "./admin-logout-button";
import { AdminProductManager } from "./admin-product-manager";

const failedQueue: {
  orderId: string;
  product: string;
  reason: string;
  next: string;
}[] = [];

export async function AdminDashboard() {
  const products = await getAdminProducts();
  const visibleProducts = products.filter((product) => product.active && product.available);
  const revenue = products.reduce(
    (sum, product) => sum + product.variations.reduce((subtotal, variation) => subtotal + variation.priceMyr, 0),
    0,
  );
  const profit = products.reduce(
    (sum, product) =>
      sum +
      product.variations.reduce(
        (subtotal, variation) => subtotal + variation.priceMyr - variation.costMyr,
        0,
      ),
    0,
  );

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-200 bg-white p-5 lg:block">
        <div className="font-display text-3xl font-bold uppercase">Kaitou Admin</div>
        <nav className="mt-8 grid gap-2 text-sm font-bold text-slate-600">
          {[
            ["Dashboard", Boxes],
            ["Failed review", AlertTriangle],
            ["Products", Boxes],
            ["Staff", Users],
            ["Integrations", KeyRound],
            ["Settings", Settings],
          ].map(([label, Icon]) => (
            <a key={String(label)} className="flex items-center gap-3 rounded-md px-3 py-3 hover:bg-slate-100" href="#">
              <Icon className="h-4 w-4" />
              {String(label)}
            </a>
          ))}
        </nav>
      </aside>

      <section className="lg:pl-72">
        <header className="border-b border-slate-200 bg-white px-5 py-5">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div>
              <p className="text-sm font-bold uppercase text-sky-600">Control center</p>
              <h1 className="font-display text-4xl font-bold">Dashboard</h1>
            </div>
            <AdminLogoutButton />
          </div>
        </header>

        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-8">
          <section className="grid gap-4 md:grid-cols-3">
            {[
              ["Visible products", visibleProducts.length.toString(), Boxes],
              ["Listed product value", formatMyr(revenue), CircleDollarSign],
              ["Projected margin", formatMyr(profit), CircleDollarSign],
            ].map(([label, value, Icon]) => (
              <div key={String(label)} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <Icon className="mb-5 h-5 w-5 text-sky-600" />
                <p className="text-sm font-semibold text-slate-500">{String(label)}</p>
                <strong className="mt-2 block text-3xl">{String(value)}</strong>
              </div>
            ))}
          </section>

          <AdminProductManager />

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 p-5">
              <div>
                <h2 className="font-display text-3xl font-bold">Failed order review</h2>
                <p className="text-sm text-slate-500">SOP: retry, contact customer, manual fulfill, mark refund, record refund.</p>
              </div>
              <span className="rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
                {failedQueue.length} needs review
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Order</th>
                    <th className="px-5 py-3">Product</th>
                    <th className="px-5 py-3">Reason</th>
                    <th className="px-5 py-3">Next action</th>
                  </tr>
                </thead>
                <tbody>
                  {failedQueue.length > 0 ? (
                    failedQueue.map((order) => (
                      <tr key={order.orderId} className="border-t border-slate-100">
                        <td className="px-5 py-4 font-bold">{order.orderId}</td>
                        <td className="px-5 py-4">{order.product}</td>
                        <td className="px-5 py-4 text-slate-600">{order.reason}</td>
                        <td className="px-5 py-4">
                          <span className="rounded-md bg-sky-50 px-3 py-1 font-bold text-sky-700">
                            {order.next}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr className="border-t border-slate-100">
                      <td className="px-5 py-8 text-center text-slate-500" colSpan={4}>
                        No failed orders are waiting for review.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="font-display text-3xl font-bold">Integration settings</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Dashboard screens will manage ToyyibPay, FazerCards, WhatsApp Business API,
                admin email, and low-balance alerts. Credentials stay server-side.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="font-display text-3xl font-bold">Staff permissions</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Admin can manage everything. Support focuses on failed orders, customer
                communication, review notes, and non-financial support actions.
              </p>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
