import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";

import { markOrderPaymentCallback } from "@/lib/orders";

function getPayloadValue(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];

    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
  }

  return "";
}

function isValidToyyibPayHash(input: {
  secretKey: string;
  status: string;
  orderId: string;
  refNo: string;
  receivedHash: string;
}) {
  if (!input.receivedHash || !input.status || !input.orderId || !input.refNo) {
    return false;
  }

  const expected = createHash("md5")
    .update(`${input.secretKey}${input.status}${input.orderId}${input.refNo}ok`)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(input.receivedHash.toLowerCase(), "hex");

  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

function parsePaymentStatus(status: string): "success" | "pending" | "failed" {
  if (status === "1") {
    return "success";
  }

  if (status === "3") {
    return "failed";
  }

  return "pending";
}

export async function POST(request: Request) {
  if (process.env.CHECKOUT_ENABLED !== "true") {
    return NextResponse.json({ error: "Payments are not enabled." }, { status: 503 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  const payload =
    contentType.includes("application/json")
      ? await request.json().catch(() => ({}))
      : Object.fromEntries((await request.formData()).entries());
  const body = payload as Record<string, unknown>;

  const secretKey = process.env.TOYYIBPAY_SECRET_KEY;

  if (!secretKey) {
    return NextResponse.json({ error: "ToyyibPay secret is not configured." }, { status: 500 });
  }

  const orderId = getPayloadValue(body, [
    "order_id",
    "orderId",
    "billExternalReferenceNo",
    "externalReferenceNo",
  ]);
  const billCode = getPayloadValue(body, ["billcode", "billCode", "BillCode"]);
  const status = getPayloadValue(body, ["status", "status_id", "statusId", "billpaymentStatus"]);
  const refNo = getPayloadValue(body, ["refno", "refNo", "fpx_transaction_id", "transaction_id"]);
  const receivedHash = getPayloadValue(body, ["hash"]);

  if (
    !isValidToyyibPayHash({
      secretKey,
      status,
      orderId,
      refNo,
      receivedHash,
    })
  ) {
    return NextResponse.json({ error: "Invalid ToyyibPay callback signature." }, { status: 400 });
  }

  const amountMyrRaw = getPayloadValue(body, ["amount"]);
  const amountMyr = amountMyrRaw ? Number(amountMyrRaw) : null;
  const paymentStatus = parsePaymentStatus(status);

  const result = await markOrderPaymentCallback({
    orderId,
    billCode,
    paymentStatus,
    amountMyr: Number.isFinite(amountMyr) ? amountMyr : null,
    rawPayload: body,
  });

  return NextResponse.json({
    received: true,
    orderId,
    billCode,
    paymentStatus,
    result,
  });
}
