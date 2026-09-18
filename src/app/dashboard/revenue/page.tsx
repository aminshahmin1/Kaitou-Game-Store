import { AdminRevenueDashboard } from "@/components/admin-revenue-dashboard";
import { AdminDashboardShell, requireAdminSession } from "@/components/admin-dashboard-shell";
import { getRevenueDashboard } from "@/lib/revenue";

export const metadata = {
  title: "Revenue | Kaitou Admin",
};

export default async function DashboardRevenuePage() {
  await requireAdminSession("revenue");
  const data = await getRevenueDashboard();

  return (
    <AdminDashboardShell title="Revenue" eyebrow="Profit center" requiredPermission="revenue">
      <AdminRevenueDashboard initialData={data} />
    </AdminDashboardShell>
  );
}
