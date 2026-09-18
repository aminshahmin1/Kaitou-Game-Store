import { NextResponse } from "next/server";

import { getAdminApiSession } from "@/lib/auth/admin-api";
import { getRevenueDashboard } from "@/lib/revenue";

export async function GET(request: Request) {
  const session = await getAdminApiSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);

  try {
    const data = await getRevenueDashboard({
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Revenue dashboard load failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Revenue data could not be loaded." }, { status: 500 });
  }
}
