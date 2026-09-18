import { AdminDashboardShell } from "@/components/admin-dashboard-shell";

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
    note: "Controlled through Vercel environment variables until an editable store-settings table is approved.",
  },
  {
    label: "Currency",
    value: "MYR",
    note: "Customer prices and dashboard profit reports are shown in Malaysian Ringgit.",
  },
  {
    label: "Languages",
    value: "English default + Bahasa Malaysia",
    note: "Public copy is structured for bilingual expansion while keeping English as the default.",
  },
];

export default async function DashboardSettingsPage() {
  return (
    <AdminDashboardShell title="Settings" eyebrow="Store controls">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-display text-3xl font-bold">Store settings</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          These are read-only MVP settings. Secrets and provider setup stay outside this page while Integrations is out of scope.
        </p>
      </section>

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
