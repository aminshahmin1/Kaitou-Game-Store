import { NextResponse } from "next/server";

export async function POST() {
  // Never acknowledge an event we have not authenticated or durably processed.
  // Order status is currently reconciled through the authenticated provider API.
  return NextResponse.json(
    { received: false, error: "Supplier webhooks are not enabled." },
    { status: 503, headers: { "Retry-After": "300" } },
  );
}
