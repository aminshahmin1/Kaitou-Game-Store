import { NextResponse } from "next/server";

import { markOrderPaymentCallback } from "@/lib/orders";

const paidStatusIds = new Set(["1", "3"]);

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const payload =
    contentType.includes("application/json")
      ? await request.json().catch(() => ({}))
      : Object.fromEntries((await request.formData()).entries());

  const orderId = String(
    payload.order_id ??
      payload.orderId ??
      payload.billExternalReferenceNo ??
      payload.externalReferenceNo ??
      "",
  );
  const billCode = String(payload.billcode ?? payload.billCode ?? payload.BillCode ?? "");
  const statusId = String(payload.status_id ?? payload.statusId ?? payload.billpaymentStatus ?? "");
  const isPaid = paidStatusIds.has(statusId);

  await markOrderPaymentCallback({
    orderId,
    billCode,
    isPaid,
    rawPayload: payload as Record<string, unknown>,
  });

  return NextResponse.json({
    received: true,
    orderId,
    billCode,
    paymentStatus: isPaid ? "paid" : "unpaid_or_pending",
    nextAction: isPaid ? "fulfill_order" : "ignore_until_paid",
  });
}
