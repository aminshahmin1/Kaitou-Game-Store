import { AdminReviewQueue } from "@/components/admin-review-queue";
import { AdminDashboardShell, requireAdminSession } from "@/components/admin-dashboard-shell";
import { getReviewOrders } from "@/lib/admin-orders";

export const metadata = { title: "Orders | Kaitou Admin" };
export default async function OrdersPage() {
  await requireAdminSession("review");
  const orders = await getReviewOrders({ allPaid: true });
  return <AdminDashboardShell title="Orders" requiredPermission="review">
    <AdminReviewQueue initialOrders={orders} allPaid />
  </AdminDashboardShell>;
}
