import { AdminDashboardShell } from "@/components/admin-dashboard-shell";

export const metadata = {
  title: "Integrations | Kaitou Admin",
};

const integrations = [
  ["ToyyibPay", "Payment collection and callbacks."],
  ["FazerCards", "Product catalog, balance, and fulfillment."],
  ["WhatsApp Business API", "Customer order updates and support messages."],
  ["Email", "Admin order receipts and support notifications."],
];

export default async function DashboardIntegrationsPage() {
  return (
    <AdminDashboardShell title="Integrations" eyebrow="Configuration" requiredPermission="integrations">
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
