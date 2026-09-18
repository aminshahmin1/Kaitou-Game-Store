import "server-only";

import { createHmac } from "crypto";

import { dashboardPermissions, type DashboardPermission } from "./permissions";
import { verifyPasswordHash } from "./password";
import { authenticateStaffAccount, getActiveStaffSession } from "../staff";

const sessionCookieName = "kaitou_admin_session";
const sessionTtlSeconds = 60 * 60 * 8;

export type AdminSession = {
  email: string;
  role: "owner" | "staff";
  staffId?: string;
  permissions: DashboardPermission[];
  exp: number;
};

export function getAdminSessionCookieName() {
  return sessionCookieName;
}

export async function verifyDashboardCredentials(email: string, password: string) {
  const expectedEmail = process.env.ADMIN_EMAIL;
  const storedHash = process.env.ADMIN_PASSWORD_PBKDF2;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;
  const normalizedEmail = email.trim().toLowerCase();

  if (
    expectedEmail &&
    storedHash &&
    sessionSecret &&
    normalizedEmail === expectedEmail.toLowerCase() &&
    verifyPasswordHash(password, storedHash)
  ) {
    return {
      email: expectedEmail,
      role: "owner" as const,
      permissions: [...dashboardPermissions],
    };
  }

  if (normalizedEmail === expectedEmail?.trim().toLowerCase()) {
    return null;
  }

  const staff = await authenticateStaffAccount(email, password);

  if (!staff) {
    return null;
  }

  return {
    email: staff.email,
    role: "staff" as const,
    staffId: staff.id,
    permissions: staff.permissions,
  };
}

export function createAdminSession(account: Omit<AdminSession, "exp">) {
  const session: AdminSession = {
    ...account,
    exp: Math.floor(Date.now() / 1000) + sessionTtlSeconds,
  };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const signature = signPayload(payload);

  return `${payload}.${signature}`;
}

export function verifyAdminSession(cookieValue?: string) {
  if (!cookieValue) {
    return null;
  }

  const [payload, signature] = cookieValue.split(".");

  if (!payload || !signature || signPayload(payload) !== signature) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AdminSession | {
      email: string;
      role: "admin";
      exp: number;
    };

    if (session.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    if (session.role === "admin") {
      return {
        email: session.email,
        role: "owner" as const,
        permissions: [...dashboardPermissions],
        exp: session.exp,
      };
    }

    if (session.role !== "owner" && session.role !== "staff") {
      return null;
    }

    return {
      ...session,
      permissions: Array.isArray(session.permissions) ? session.permissions : [],
    };
  } catch {
    return null;
  }
}

export async function resolveDashboardSession(session: AdminSession | null) {
  if (!session) {
    return null;
  }

  if (session.role === "owner") {
    return {
      ...session,
      permissions: [...dashboardPermissions],
    };
  }

  if (!session.staffId) {
    return null;
  }

  const staff = await getActiveStaffSession(session.staffId);

  if (!staff) {
    return null;
  }

  return {
    ...session,
    email: staff.email,
    permissions: staff.permissions,
  };
}

export function getAdminSessionMaxAge() {
  return sessionTtlSeconds;
}

function signPayload(payload: string) {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret) {
    return "";
  }

  return createHmac("sha256", secret).update(payload).digest("base64url");
}
