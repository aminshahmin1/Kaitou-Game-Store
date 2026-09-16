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
    billName: `${input.product.title} - ${input.variation.title}`.slice(0, 100),
    billDescription: `Kaitou Game Store order ${input.orderId} for ${input.product.title} (${input.variation.title})`.slice(0, 200),
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

  const data = await response.json();
  const billCode = Array.isArray(data) ? data[0]?.BillCode : data?.BillCode;

  if (!billCode || typeof billCode !== "string") {
    throw new Error("ToyyibPay did not return a bill code.");
  }

  return {
    paymentSetupRequired: false,
    paymentUrl: `${apiBaseUrl.replace(/\/$/, "")}/${billCode}`,
    providerReference: billCode,
  };
}
