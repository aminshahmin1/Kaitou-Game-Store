import { NextResponse } from "next/server";

import {
  createAdminSession,
  getAdminSessionCookieName,
  getAdminSessionMaxAge,
  verifyDashboardCredentials,
} from "@/lib/auth/admin-session";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const email = String(payload?.email ?? "");
  const password = String(payload?.password ?? "");

  const account = await verifyDashboardCredentials(email, password);

  if (!account) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });

  response.cookies.set({
    name: getAdminSessionCookieName(),
    value: createAdminSession(account),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: getAdminSessionMaxAge(),
  });

  return response;
}
