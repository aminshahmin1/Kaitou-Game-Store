import { AdminDashboardShell } from "@/components/admin-dashboard-shell";

export const metadata = {
  title: "Settings | Kaitou Admin",
};

export default async function DashboardSettingsPage() {
  return (
    <AdminDashboardShell title="Settings" eyebrow="Store controls">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-display text-3xl font-bold">Store settings</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Store-wide configuration will live here, including storefront language,
          support details, low-balance alerts, and checkout readiness controls.
        </p>
      </section>
    </AdminDashboardShell>
  );
}
