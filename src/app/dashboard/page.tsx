import { cookies } from "next/headers";

import { AdminDashboardOverview } from "@/components/admin-dashboard-overview";
import { AdminDashboardShell } from "@/components/admin-dashboard-shell";
import { AdminLoginForm } from "@/components/admin-login-form";
import {
  getAdminSessionCookieName,
  resolveDashboardSession,
  verifyAdminSession,
} from "@/lib/auth/admin-session";

export const metadata = {
  title: "Dashboard | Kaitou Game Store",
};

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const session = await resolveDashboardSession(
    verifyAdminSession(cookieStore.get(getAdminSessionCookieName())?.value),
  );

  if (session) {
    return (
      <AdminDashboardShell title="Dashboard">
        <AdminDashboardOverview session={session} />
      </AdminDashboardShell>
    );
  }

  return (
    <main className="trust-surface grid min-h-screen place-items-center px-5 py-12">
      <section className="w-full max-w-md">
        <AdminLoginForm />
      </section>
    </main>
  );
}
