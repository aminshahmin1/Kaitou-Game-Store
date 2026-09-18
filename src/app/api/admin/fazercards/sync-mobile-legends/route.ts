import { NextResponse } from "next/server";

import { getAdminApiSession } from "@/lib/auth/admin-api";
import { importFazerCardsMobileLegendsMalaysiaDraft } from "@/lib/products";

export async function POST() {
  const session = await getAdminApiSession("products");

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
