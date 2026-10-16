import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { checkBalanceAndNotify } from "@/lib/balance-monitor";
import { reconcileProviderOrders } from "@/lib/fulfillment-sync";

export const maxDuration = 60;

export async function POST(request: Request) {
  const secret = process.env.BALANCE_MONITOR_SECRET;
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const fulfillment = await reconcileProviderOrders();
    const balance = await checkBalanceAndNotify();
    return NextResponse.json({ ...balance, fulfillment }, { status: fulfillment.failed ? 503 : 200 });
  } catch {
    return NextResponse.json({ error: "Balance monitoring failed." }, { status: 503 });
  }
}
