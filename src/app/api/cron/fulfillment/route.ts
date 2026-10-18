import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { recoverInterruptedFulfillment } from "@/lib/fulfillment-recovery";
import { reconcileProviderOrders } from "@/lib/fulfillment-sync";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

export async function POST(request: Request) {
  const secret = process.env.BALANCE_MONITOR_SECRET;
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const db = createSupabaseAdminClient();
    if (!db) throw new Error("Database is not configured.");
    const { error } = await db.rpc("expire_supplier_reservations");
    if (error) throw new Error("Reservation expiry failed.");
    const recovery = await recoverInterruptedFulfillment();
    const fulfillment = await reconcileProviderOrders();
    return NextResponse.json({ recovery, fulfillment }, { status: fulfillment.failed ? 503 : 200 });
  } catch {
    return NextResponse.json({ error: "Fulfillment reconciliation needs attention." }, { status: 503 });
  }
}
