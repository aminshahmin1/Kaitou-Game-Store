import { redirect } from "next/navigation";
import { AdminDashboardShell, requireAdminSession } from "@/components/admin-dashboard-shell";
import { CheckoutForm } from "@/components/checkout-form";
import { getStoreProductBySlug } from "@/lib/products";

export const metadata = { title: "Launch Test | Kaitou Admin" };
export default async function LaunchTestPage() {
  const session = await requireAdminSession();
  if (session.role !== "owner") redirect("/dashboard");
  const product = await getStoreProductBySlug("mobile-legends-malaysia");
  return <AdminDashboardShell title="Launch test" eyebrow="Owner only">
    <p className="text-sm text-slate-600">This uses live FPX and FazerCards. Test orders use real funds and are excluded from sales revenue.</p>
    {product?.available ? <CheckoutForm product={product} launchTest /> : <p>No affordable Mobile Legends package is available. Sync the balance and product prices before testing.</p>}
  </AdminDashboardShell>;
}
