import { AdminDashboardShell } from "@/components/admin-dashboard-shell";

export const metadata = {
  title: "Staff | Kaitou Admin",
};

const roles = [
  {
    name: "Admin",
    access: "Full dashboard access",
    details: "Products, revenue, review orders, staff planning, settings, and integrations.",
  },
  {
    name: "Support",
    access: "Support-focused access",
    details: "Failed/review orders, customer contact notes, support status updates, and refund references.",
  },
];

export default async function DashboardStaffPage() {
  return (
    <AdminDashboardShell title="Staff" eyebrow="Permissions">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-display text-3xl font-bold">Staff permissions</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          The current MVP uses one secure admin login. Staff account creation is intentionally not enabled yet,
          because adding staff login and invites changes the security model.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {roles.map((role) => (
          <article key={role.name} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase text-sky-600">{role.access}</p>
            <h2 className="mt-2 font-display text-3xl font-bold">{role.name}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{role.details}</p>
          </article>
        ))}
      </section>

      <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
        <h2 className="font-display text-2xl font-bold">Approval needed later</h2>
        <p className="mt-2">
          To make real staff accounts, the next safe step is a Supabase Auth invite flow with role checks on every admin API.
          I have not enabled that yet because you asked me not to add new features without permission.
        </p>
      </section>
    </AdminDashboardShell>
  );
}
