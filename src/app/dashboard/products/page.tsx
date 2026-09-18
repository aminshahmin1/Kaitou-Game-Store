import { AdminDashboardShell } from "@/components/admin-dashboard-shell";
import { AdminProductManager } from "@/components/admin-product-manager";

export const metadata = {
  title: "Products | Kaitou Admin",
};

export default async function DashboardProductsPage() {
  return (
    <AdminDashboardShell title="Products" eyebrow="Listings" requiredPermission="products">
      <AdminProductManager />
    </AdminDashboardShell>
  );
}
