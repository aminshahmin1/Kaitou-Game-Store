import "server-only";

import { cookies } from "next/headers";

import {
  getAdminSessionCookieName,
  verifyAdminSession,
  type AdminSession,
} from "./admin-session";

export async function getAdminApiSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  return verifyAdminSession(cookieStore.get(getAdminSessionCookieName())?.value);
}
