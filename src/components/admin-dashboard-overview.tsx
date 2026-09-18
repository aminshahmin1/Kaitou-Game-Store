import Link from "next/link";
import { AlertTriangle, BarChart3, Boxes, CircleDollarSign, KeyRound, Layers3 } from "lucide-react";

import { getReviewOrders } from "@/lib/admin-orders";
import type { AdminSession } from "@/lib/auth/admin-session";
import { hasDashboardPermission } from "@/lib/auth/permissions";
import { formatMyr } from "@/lib/catalog";
import { getAdminProducts } from "@/lib/products";
import { getRevenueDashboard } from "@/lib/revenue";

export async function AdminDashboardOverview({ session }: { session: AdminSession }) {
  const canProducts = hasDashboardPermission(session, "products");
  const canRevenue = hasDashboardPermission(session, "revenue");
  const canReview = hasDashboardPermission(session, "review");

  const [products, revenue, reviewOrders] = await Promise.all([
    canProducts ? getAdminProducts() : Promise.resolve([]),
    canRevenue ? getRevenueDashboard() : Promise.resolve(null),
    canReview ? getReviewOrders() : Promise.resolve([]),
  ]);
  const visibleProducts = products.filter((product) => product.active && product.available);
  const listedValue = products.reduce(
    (sum, product) => sum + product.variations.reduce((subtotal, variation) => subtotal + variation.priceMyr, 0),
    0,
  );

  const cards = [
    canProducts ? { label: "Visible products", value: visibleProducts.length.toString(), icon: Boxes } : null,
    canProducts ? { label: "Listed product value", value: formatMyr(listedValue), icon: CircleDollarSign } : null,
    canRevenue && revenue ? { label: "Month net profit", value: formatMyr(revenue.summary.netProfitMyr), icon: BarChart3 } : null,
    canRevenue && revenue ? { label: "Funding available", value: `${revenue.summary.availableFundingUsd.toFixed(4)} USDT`, icon: Layers3 } : null,
    canRevenue && revenue ? { label: "Pending allocation", value: revenue.summary.unallocatedOrders.toString(), icon: CircleDollarSign } : null,
    canReview ? { label: "Review queue", value: reviewOrders.length.toString(), icon: AlertTriangle } : null,
  ].filter((card): card is { label: string; value: string; icon: typeof Boxes } => Boolean(card));

  const sections = [
    canProducts ? {
      href: "/dashboard/products",
      title: "Products",
      copy: "Import FazerCards items, edit SKUs, set MYR prices, and publish listings.",
      icon: Boxes,
    } : null,
    canRevenue ? {
      href: "/dashboard/revenue",
      title: "Revenue",
      copy: "Add funding batches, allocate paid order costs, and monitor profit reports.",
      icon: BarChart3,
    } : null,
    canReview ? {
      href: "/dashboard/review",
      title: "Failed review",
      copy: "Review failed orders, contact customers, retry fulfillment, or prepare refunds.",
      icon: AlertTriangle,
    } : null,
    hasDashboardPermission(session, "integrations") ? {
      href: "/dashboard/integrations",
      title: "Integrations",
      copy: "Manage provider, payment, notification, and email setup screens.",
      icon: KeyRound,
    } : null,
  ].filter((section): section is { href: string; title: string; copy: string; icon: typeof Boxes } => Boolean(section));

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
