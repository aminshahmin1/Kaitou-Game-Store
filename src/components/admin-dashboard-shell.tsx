import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  KeyRound,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";

import { AdminLogoutButton } from "@/components/admin-logout-button";
import {
  getAdminSessionCookieName,
  resolveDashboardSession,
  verifyAdminSession,
} from "@/lib/auth/admin-session";
import {
  hasDashboardPermission,
  type DashboardPermission,
} from "@/lib/auth/permissions";

const navigation: Array<{
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission?: DashboardPermission;
}> = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/products", label: "Products", icon: Boxes, permission: "products" },
  { href: "/dashboard/review", label: "Failed review", icon: AlertTriangle, permission: "review" },
  { href: "/dashboard/revenue", label: "Revenue", icon: BarChart3, permission: "revenue" },
  { href: "/dashboard/staff", label: "Staff", icon: Users, permission: "staff" },
  { href: "/dashboard/integrations", label: "Integrations", icon: KeyRound, permission: "integrations" },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, permission: "settings" },
];

export async function requireAdminSession(permission?: DashboardPermission) {
  const cookieStore = await cookies();
  const session = await resolveDashboardSession(
    verifyAdminSession(cookieStore.get(getAdminSessionCookieName())?.value),
  );

  if (!session) {
    redirect("/dashboard");
  }

  if (!hasDashboardPermission(session, permission)) {
    redirect("/dashboard");
  }

  return session;
}

export async function AdminDashboardShell({
  title,
  eyebrow = "Control center",
  requiredPermission,
  children,
}: {
  title: string;
  eyebrow?: string;
  requiredPermission?: DashboardPermission;
  children: React.ReactNode;
}) {
  const session = await requireAdminSession(requiredPermission);
  const visibleNavigation = navigation.filter((item) => hasDashboardPermission(session, item.permission));

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-200 bg-white p-5 lg:block">
        <div className="font-display text-3xl font-bold uppercase">Kaitou Admin</div>
        <nav className="mt-8 grid gap-2 text-sm font-bold text-slate-600">
          {visibleNavigation.map((item) => (
            <Link
              key={item.href}
              className="flex min-h-11 items-center gap-3 rounded-md px-3 py-3 hover:bg-slate-100"
              href={item.href}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-5 left-5 right-5 rounded-md bg-slate-50 p-3 text-xs font-semibold text-slate-500">
          <p className="truncate text-slate-700">{session.email}</p>
          <p className="mt-1 uppercase">{session.role === "owner" ? "Owner" : "Staff"}</p>
        </div>
      </aside>

      <section className="lg:pl-72">
        <header className="border-b border-slate-200 bg-white px-5 py-5">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-bold uppercase text-sky-600">{eyebrow}</p>
              <h1 className="break-words font-display text-4xl font-bold">{title}</h1>
            </div>
            <AdminLogoutButton />
          </div>
          <nav className="mx-auto mt-5 flex max-w-7xl gap-2 overflow-x-auto pb-1 text-sm font-bold text-slate-600 lg:hidden">
            {visibleNavigation.map((item) => (
              <Link
                key={item.href}
                className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2"
                href={item.href}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </header>

        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-8">{children}</div>
      </section>
    </main>
  );
}
