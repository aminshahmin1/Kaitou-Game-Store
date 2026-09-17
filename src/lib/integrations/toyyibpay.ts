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
    .replace(/[^a-zA-Z0-9 _-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export async function createToyyibPayBill(input: ToyyibPayBillInput) {
  const secretKey = process.env.TOYYIBPAY_SECRET_KEY;
  const categoryCode = process.env.TOYYIBPAY_CATEGORY_CODE;
  const apiBaseUrl = process.env.TOYYIBPAY_API_BASE_URL ?? "https://toyyibpay.com";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const returnUrl = process.env.TOYYIBPAY_RETURN_URL ?? `${siteUrl}/order-status`;
  const callbackUrl = process.env.TOYYIBPAY_CALLBACK_URL ?? `${siteUrl}/api/webhooks/toyyibpay`;

  if (!secretKey || !categoryCode) {
    return {
      paymentSetupRequired: true,
      paymentUrl: `/checkout/payment-unavailable?orderId=${encodeURIComponent(input.orderId)}`,
      providerReference: null,
    };
  }

  const billAmountInSen = Math.round(input.variation.priceMyr * 100);
  const formData = new URLSearchParams({
    userSecretKey: secretKey,
    categoryCode,
    billName: cleanToyyibText(`Kaitou ${input.orderId}`, 30),
    billDescription: cleanToyyibText(
      `${input.product.title} ${input.variation.title} ${input.orderId}`,
      100,
    ),
    billPriceSetting: "1",
    billPayorInfo: "1",
    billAmount: String(billAmountInSen),
    billReturnUrl: returnUrl,
    billCallbackUrl: callbackUrl,
    billExternalReferenceNo: input.orderId,
    billTo: input.customerName,
    billEmail: input.customerEmail,
    billPhone: input.whatsapp,
    billSplitPayment: "0",
    billSplitPaymentArgs: "",
    billPaymentChannel: "0",
    billContentEmail: "Thank you for ordering from Kaitou Game Store.",
    billChargeToCustomer: "1",
  });

  const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/index.php/api/createBill`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`ToyyibPay createBill failed with HTTP ${response.status}`);
  }

  const text = await response.text();
  const data = tryParseJson(text);
  const billCode = Array.isArray(data)
    ? getStringProperty(data[0], "BillCode")
    : getStringProperty(data, "BillCode");

  if (!billCode || typeof billCode !== "string") {
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
