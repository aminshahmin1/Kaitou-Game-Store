import { AdminStaffManager } from "@/components/admin-staff-manager";
import { AdminDashboardShell, requireAdminSession } from "@/components/admin-dashboard-shell";
import { getStaffAccounts } from "@/lib/staff";

export const metadata = {
  title: "Staff | Kaitou Admin",
};

export default async function DashboardStaffPage() {
  await requireAdminSession("staff");
  const staff = await getStaffAccounts();

  return (
    <AdminDashboardShell title="Staff" eyebrow="Permissions" requiredPermission="staff">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-display text-3xl font-bold">Staff accounts and permissions</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Create staff logins, set passwords, and tick only the dashboard sections each staff member can use.
        </p>
      </section>

      <AdminStaffManager initialStaff={staff} />
    </AdminDashboardShell>
  );
}
