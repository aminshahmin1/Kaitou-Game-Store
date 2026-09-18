import { AdminReviewQueue } from "@/components/admin-review-queue";
import { AdminDashboardShell, requireAdminSession } from "@/components/admin-dashboard-shell";
import { getReviewOrders } from "@/lib/admin-orders";

export const metadata = {
  title: "Failed Review | Kaitou Admin",
};

export default async function DashboardReviewPage() {
  await requireAdminSession("review");
  const orders = await getReviewOrders();

  return (
    <AdminDashboardShell title="Failed order review" eyebrow="Support" requiredPermission="review">
      <AdminReviewQueue initialOrders={orders} />
    </AdminDashboardShell>
  );
}
