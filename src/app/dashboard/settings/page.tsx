import { AdminDashboardShell } from "@/components/admin-dashboard-shell";
import { AdminExchangeRate } from "@/components/admin-exchange-rate";
import { getFundingCostBasis } from "@/lib/funding-cost";
import { getAdminApiSession } from "@/lib/auth/admin-api";

export const metadata = {
  title: "Settings | Kaitou Admin",
};

const settings = [
  {
    label: "Storefront",
    value: "kaitou.shop",
    note: "Public pages stay customer-facing; the dashboard remains at /dashboard.",
  },
  {
    label: "Checkout",
    value: process.env.CHECKOUT_ENABLED === "true" ? "Enabled" : "Disabled",
    note: "Managed through CHECKOUT_ENABLED in the Vercel production environment. Changing it requires a deployment.",
  },
  {
    label: "Currency",
    value: "MYR",
    note: "Customer prices and dashboard profit reports are shown in Malaysian Ringgit.",
  },
  {
    label: "Languages",
    value: "English",
    note: "Bahasa Malaysia translation is not available yet.",
  },
];

export default async function DashboardSettingsPage() {
  const session = await getAdminApiSession("settings");
  const basis = session?.role === "owner" ? await getFundingCostBasis() : null;
  return (
    <AdminDashboardShell title="Settings" eyebrow="Store controls" requiredPermission="settings">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-display text-3xl font-bold">Store settings</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Store configuration is shown below. Payment and email connection checks are available on the Integrations page. Credentials are managed securely in Vercel.
        </p>
      </section>

      {basis && <AdminExchangeRate initialRate={basis.rate} />}
      <section className="grid gap-4 md:grid-cols-2">
        {settings.map((setting) => (
          <article key={setting.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase text-slate-500">{setting.label}</p>
            <h2 className="mt-2 break-words font-display text-3xl font-bold">{setting.value}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{setting.note}</p>
          </article>
        ))}
      </section>
    </AdminDashboardShell>
  );
}
