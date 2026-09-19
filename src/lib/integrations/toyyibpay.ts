import "server-only";

import type { Product } from "../types";
import type { ProductVariation } from "../types";

type ToyyibPayBillInput = {
  orderId: string;
  product: Product;
  variation: ProductVariation;
  customerName: string;
  customerEmail: string;
  whatsapp: string;
};

function cleanToyyibText(value: string, maxLength: number) {
  return value
    .replace(/[^a-zA-Z0-9 _]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export async function createToyyibPayBill(input: ToyyibPayBillInput) {
  return createToyyibPayPayment({
    orderId: input.orderId,
    description: `${input.product.title} ${input.variation.title} ${input.orderId}`,
    amountMyr: input.variation.priceMyr,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    whatsapp: input.whatsapp,
  });
}

export async function createToyyibPayPayment(input: {
  orderId: string;
  description: string;
  amountMyr: number;
  customerName: string;
  customerEmail: string;
  whatsapp: string;
  test?: boolean;
}) {
  const secretKey = process.env.TOYYIBPAY_SECRET_KEY;
  const categoryCode = process.env.TOYYIBPAY_CATEGORY_CODE;
  const apiBaseUrl = process.env.TOYYIBPAY_API_BASE_URL ?? "https://toyyibpay.com";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const returnUrl = new URL(input.test ? `${siteUrl}/dashboard/integrations` : process.env.TOYYIBPAY_RETURN_URL ?? `${siteUrl}/order-status`);
  returnUrl.searchParams.set("order_id", input.orderId);
  const callbackUrl = process.env.TOYYIBPAY_CALLBACK_URL ?? `${siteUrl}/api/webhooks/toyyibpay`;

  if (!secretKey || !categoryCode) {
    throw new Error("ToyyibPay credentials are not configured.");
  }

  const billAmountInSen = Math.round(input.amountMyr * 100);
  if (!Number.isSafeInteger(billAmountInSen) || billAmountInSen < 100) {
    throw new Error("FPX payments require an order total of at least RM1.00.");
  }
  const formData = new URLSearchParams({
    userSecretKey: secretKey,
    categoryCode,
    billName: cleanToyyibText(`Kaitou ${input.orderId}`, 30),
    billDescription: cleanToyyibText(
      input.description,
      100,
    ),
    billPriceSetting: "1",
    billPayorInfo: "1",
    billAmount: String(billAmountInSen),
    billReturnUrl: returnUrl.toString(),
    billCallbackUrl: callbackUrl,
    billExternalReferenceNo: input.orderId,
    billTo: input.customerName,
    billEmail: input.customerEmail,
    billPhone: input.whatsapp.replace(/\D/g, ""),
    billSplitPayment: "0",
    billSplitPaymentArgs: "",
    billPaymentChannel: "0",
    billContentEmail: "Thank you for ordering from Kaitou Game Store.",
    billChargeToCustomer: "",
    billExpiryDays: "1",
  });

  const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/index.php/api/createBill`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`ToyyibPay createBill failed with HTTP ${response.status}`);
  }

  const text = await response.text();
  const data = tryParseJson(text);
  const billCode = Array.isArray(data)
    ? getStringProperty(data[0], "BillCode")
    : getStringProperty(data, "BillCode");

  if (!billCode || !/^[a-zA-Z0-9]+$/.test(billCode)) {
    const message =
      getStringProperty(data, "msg")
        ? getStringProperty(data, "msg")
        : text.slice(0, 160);
    throw new Error(`ToyyibPay did not return a bill code. ${message}`);
  }

  return {
    paymentSetupRequired: false,
    paymentUrl: `${apiBaseUrl.replace(/\/$/, "")}/${billCode}`,
    providerReference: billCode,
  };
}

export async function getToyyibPayTransactions(billCode: string) {
  const base = process.env.TOYYIBPAY_API_BASE_URL ?? "https://toyyibpay.com";
  const response = await fetch(`${base.replace(/\/$/, "")}/index.php/api/getBillTransactions`, {
    method: "POST",
    body: new URLSearchParams({ billCode }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const data: unknown = await response.json();
  if (!response.ok || !Array.isArray(data)) throw new Error("ToyyibPay transaction verification unavailable.");
  return data as Array<Record<string, unknown>>;
}

export async function checkToyyibPayCategory() {
  const secret = process.env.TOYYIBPAY_SECRET_KEY;
  const category = process.env.TOYYIBPAY_CATEGORY_CODE;
  if (!secret || !category) return { configured: false, active: false };
  const base = process.env.TOYYIBPAY_API_BASE_URL ?? "https://toyyibpay.com";
  const response = await fetch(`${base.replace(/\/$/, "")}/index.php/api/getCategoryDetails`, {
    method: "POST",
    body: new URLSearchParams({ userSecretKey: secret, categoryCode: category }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  const categoryData = Array.isArray(data) ? data[0] : data;
  return { configured: true, active: response.ok && String(categoryData?.categoryStatus) === "1" };
}

function tryParseJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function getStringProperty(value: unknown, key: string) {
  return value && typeof value === "object" && key in value && typeof value[key as keyof typeof value] === "string"
    ? String(value[key as keyof typeof value])
    : null;
}
