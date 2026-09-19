import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";

import { markOrderPaymentCallback } from "@/lib/orders";
import { getToyyibPayTransactions } from "@/lib/integrations/toyyibpay";
import { recordToyyibPayTestCallback } from "@/lib/toyyibpay-tests";

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
  if (!/^[a-fA-F0-9]{32}$/.test(input.receivedHash) || !input.status || !input.orderId || !input.refNo) {
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
  try {
    return await handleCallback(request);
  } catch {
    return NextResponse.json({ error: "Payment verification temporarily unavailable. Retry callback." }, { status: 503 });
  }
}

async function handleCallback(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const payload =
    contentType.includes("application/json")
      ? await request.json().catch(() => ({}))
      : await request.formData().then((data) => Object.fromEntries(data.entries())).catch(() => ({}));
  const body = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;

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

  if (!["1", "2", "3"].includes(status) || !billCode || !orderId) {
    return NextResponse.json({ error: "Invalid callback fields." }, { status: 400 });
  }

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

  if (paymentStatus === "success") {
    if (amountMyr === null || !Number.isFinite(amountMyr) || amountMyr <= 0) {
      return NextResponse.json({ error: "Invalid payment amount." }, { status: 400 });
    }
    const transactions = await getToyyibPayTransactions(billCode);
    const confirmed = transactions.some((transaction) =>
      String(transaction.billpaymentStatus) === "1" &&
      String(transaction.billExternalReferenceNo) === orderId &&
      Math.round(Number(transaction.billpaymentAmount) * 100) === Math.round(amountMyr * 100),
    );
    if (!confirmed) {
      return NextResponse.json({ error: "Payment has not been confirmed by ToyyibPay." }, { status: 503 });
    }
  }

  const handler = orderId.startsWith("KTEST-") ? recordToyyibPayTestCallback : markOrderPaymentCallback;
  const result = await handler({
    orderId,
    billCode,
    paymentStatus,
    amountMyr: Number.isFinite(amountMyr) ? amountMyr : null,
    rawPayload: body,
  });

  if (!result.processed && result.reason !== "amount_mismatch") {
    return NextResponse.json({ error: "Callback could not be matched to a payment." }, { status: 409 });
  }

  return NextResponse.json({
    received: true,
    orderId,
    billCode,
    paymentStatus,
    result,
  });
}
