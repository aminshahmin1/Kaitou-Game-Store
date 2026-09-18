import "server-only";

import { cookies } from "next/headers";

import {
  getAdminSessionCookieName,
  resolveDashboardSession,
  verifyAdminSession,
  type AdminSession,
} from "./admin-session";
import { hasDashboardPermission, type DashboardPermission } from "./permissions";

export async function getAdminApiSession(permission?: DashboardPermission): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const session = await resolveDashboardSession(
    verifyAdminSession(cookieStore.get(getAdminSessionCookieName())?.value),
  );

  if (!session || !hasDashboardPermission(session, permission)) {
    return null;
  }

  return session;
}
