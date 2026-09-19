import { AdminDashboardShell, requireAdminSession } from "@/components/admin-dashboard-shell";
import { AdminToyyibPay } from "@/components/admin-toyyibpay";

export const metadata = {
  title: "Integrations | Kaitou Admin",
};

const integrations = [
  ["FazerCards", "Product catalog, balance, and fulfillment."],
  ["WhatsApp Business API", "Customer order updates and support messages."],
  ["Email", "Admin order receipts and support notifications."],
];

export default async function DashboardIntegrationsPage() {
  const session = await requireAdminSession("integrations");
  return (
    <AdminDashboardShell title="Integrations" eyebrow="Configuration" requiredPermission="integrations">
      {session.role === "owner" ? <AdminToyyibPay /> : <p className="text-sm text-slate-600">ToyyibPay payment configuration is managed by the owner.</p>}
      <section className="grid gap-4 md:grid-cols-2">
        {integrations.map(([name, copy]) => (
          <div key={name} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-display text-3xl font-bold">{name}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{copy}</p>
          </div>
        ))}
      </section>
    </AdminDashboardShell>
  );
}
