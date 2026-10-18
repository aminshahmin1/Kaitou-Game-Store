import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { reconcileNextBundle } from "@/lib/bundle-fulfillment";

export const maxDuration = 60;

export async function POST(request: Request) {
  const secret = process.env.BALANCE_MONITOR_SECRET;
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    return NextResponse.json(await reconcileNextBundle());
  } catch {
    return NextResponse.json({ error: "Custom package reconciliation needs attention." }, { status: 503 });
  }
}
