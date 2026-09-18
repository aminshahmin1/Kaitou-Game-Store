import { NextResponse } from "next/server";

import { getReviewOrders } from "@/lib/admin-orders";
import { getAdminApiSession } from "@/lib/auth/admin-api";

export async function GET() {
  const session = await getAdminApiSession("review");

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const orders = await getReviewOrders();
    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Review orders load failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Review orders could not be loaded." }, { status: 500 });
  }
}
