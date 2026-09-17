import { NextResponse } from "next/server";
import { z } from "zod";

import { lookupPublicOrder } from "@/lib/orders";

const orderLookupSchema = z.object({
  orderNumber: z.string().min(4).max(80),
  contact: z.string().min(5).max(120),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = orderLookupSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter your order ID and the email or WhatsApp number used at checkout." },
      { status: 400 },
    );
  }

  const order = await lookupPublicOrder(parsed.data);

  if (!order) {
    return NextResponse.json(
      { error: "No paid order matched those details." },
      { status: 404 },
    );
  }

  return NextResponse.json({ order });
}
