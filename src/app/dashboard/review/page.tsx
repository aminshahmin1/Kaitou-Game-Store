import { AdminReviewQueue } from "@/components/admin-review-queue";
import { AdminDashboardShell } from "@/components/admin-dashboard-shell";
import { getReviewOrders } from "@/lib/admin-orders";

export const metadata = {
  title: "Failed Review | Kaitou Admin",
};

export default async function DashboardReviewPage() {
  const orders = await getReviewOrders();

  return (
    <AdminDashboardShell title="Failed order review" eyebrow="Support">
      <AdminReviewQueue initialOrders={orders} />
    </AdminDashboardShell>
  );
}
