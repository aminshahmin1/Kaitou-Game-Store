import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { deliverNextOrderEmail } from "@/lib/order-emails";

export const maxDuration = 60;
export async function POST(request: Request) {
  const secret = process.env.BALANCE_MONITOR_SECRET;
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const result = await deliverNextOrderEmail();
    return NextResponse.json(result, { status: result.failed ? 503 : 200 });
  } catch {
    return NextResponse.json({ error: "Order email delivery needs attention." }, { status: 503 });
  }
}
