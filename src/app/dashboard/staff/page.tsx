import { AdminDashboardShell } from "@/components/admin-dashboard-shell";

export const metadata = {
  title: "Staff | Kaitou Admin",
};

export default async function DashboardStaffPage() {
  return (
    <AdminDashboardShell title="Staff" eyebrow="Permissions">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-display text-3xl font-bold">Staff permissions</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Admin can manage everything. Support accounts will focus on failed orders,
          customer communication, review notes, and non-financial support actions.
        </p>
      </section>
    </AdminDashboardShell>
  );
}
