import Link from "next/link";
import { AlertTriangle, BarChart3, Boxes, CircleDollarSign, KeyRound } from "lucide-react";

import { formatMyr } from "@/lib/catalog";
import { getAdminProducts } from "@/lib/products";

export async function AdminDashboardOverview() {
  const products = await getAdminProducts();
  const visibleProducts = products.filter((product) => product.active && product.available);
  const listedValue = products.reduce(
    (sum, product) => sum + product.variations.reduce((subtotal, variation) => subtotal + variation.priceMyr, 0),
    0,
  );
  const projectedMargin = products.reduce(
    (sum, product) =>
      sum +
      product.variations.reduce(
        (subtotal, variation) => subtotal + variation.priceMyr - variation.costMyr,
        0,
      ),
    0,
  );

  const cards = [
    { label: "Visible products", value: visibleProducts.length.toString(), icon: Boxes },
    { label: "Listed product value", value: formatMyr(listedValue), icon: CircleDollarSign },
    { label: "Projected margin", value: formatMyr(projectedMargin), icon: CircleDollarSign },
  ];

  const sections = [
    {
      href: "/dashboard/products",
      title: "Products",
      copy: "Import FazerCards items, edit SKUs, set MYR prices, and publish listings.",
      icon: Boxes,
    },
    {
      href: "/dashboard/revenue",
      title: "Revenue",
      copy: "Funding ledger, FIFO order cost allocation, and profit reports will live here.",
      icon: BarChart3,
    },
    {
      href: "/dashboard/review",
      title: "Failed review",
      copy: "Review failed orders, contact customers, retry fulfillment, or prepare refunds.",
      icon: AlertTriangle,
    },
    {
      href: "/dashboard/integrations",
      title: "Integrations",
      copy: "Manage provider, payment, notification, and email setup screens.",
      icon: KeyRound,
    },
  ];

  return (
    <>
      <section className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <card.icon className="mb-5 h-5 w-5 text-sky-600" />
            <p className="text-sm font-semibold text-slate-500">{card.label}</p>
            <strong className="mt-2 block break-words text-3xl">{card.value}</strong>
          </div>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-200 hover:shadow-md"
          >
            <section.icon className="h-6 w-6 text-sky-600" />
            <div>
              <h2 className="font-display text-3xl font-bold">{section.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{section.copy}</p>
            </div>
          </Link>
        ))}
      </section>
    </>
  );
}
