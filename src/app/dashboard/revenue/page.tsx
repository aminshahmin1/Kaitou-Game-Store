import { AdminRevenueDashboard } from "@/components/admin-revenue-dashboard";
import { AdminDashboardShell } from "@/components/admin-dashboard-shell";
import { getRevenueDashboard } from "@/lib/revenue";

export const metadata = {
  title: "Revenue | Kaitou Admin",
};

export default async function DashboardRevenuePage() {
  const data = await getRevenueDashboard();

  return (
    <AdminDashboardShell title="Revenue" eyebrow="Profit center">
      <AdminRevenueDashboard initialData={data} />
    </AdminDashboardShell>
  );
}
