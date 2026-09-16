import { cookies } from "next/headers";

import { AdminDashboard } from "@/components/admin-dashboard";
import { AdminLoginForm } from "@/components/admin-login-form";
import { getAdminSessionCookieName, verifyAdminSession } from "@/lib/auth/admin-session";

export const metadata = {
  title: "Dashboard | Kaitou Game Store",
};

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const session = verifyAdminSession(cookieStore.get(getAdminSessionCookieName())?.value);

  if (session) {
    return <AdminDashboard />;
  }

  return (
    <main className="trust-surface grid min-h-screen place-items-center px-5 py-12">
      <section className="w-full max-w-md">
        <AdminLoginForm />
      </section>
    </main>
  );
}
