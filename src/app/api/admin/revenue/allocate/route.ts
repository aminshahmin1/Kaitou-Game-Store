import { NextResponse } from "next/server";

import { getAdminApiSession } from "@/lib/auth/admin-api";
import { allocatePaidOrdersFunding } from "@/lib/revenue";

export async function POST() {
  const session = await getAdminApiSession("revenue");

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await allocatePaidOrdersFunding();
    return NextResponse.json({ result });
  } catch (error) {
    console.error("Funding allocation failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Funding allocation could not be completed." }, { status: 500 });
  }
}
