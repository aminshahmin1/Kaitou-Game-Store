import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getAdminSessionCookieName, verifyAdminSession } from "@/lib/auth/admin-session";
import { importFazerCardsMobileLegendsMalaysiaDraft } from "@/lib/products";

async function requireAdmin() {
  const cookieStore = await cookies();
  return verifyAdminSession(cookieStore.get(getAdminSessionCookieName())?.value);
}

export async function POST() {
  const session = await requireAdmin();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await importFazerCardsMobileLegendsMalaysiaDraft();
    return NextResponse.json(result);
  } catch (error) {
    console.error("FazerCards Mobile Legends sync failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      { error: "FazerCards catalog could not be synced." },
      { status: 500 },
    );
  }
}
