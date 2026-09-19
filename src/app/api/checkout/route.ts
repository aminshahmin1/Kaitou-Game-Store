import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { createToyyibPayBill } from "@/lib/integrations/toyyibpay";
import { attachPaymentReference, createPendingOrder } from "@/lib/orders";
import { getStoreProductBySlug } from "@/lib/products";
import { checkoutSchema } from "@/lib/validation";

function createOrderId() {
  return `KGS-${randomUUID().replace(/-/g, "").slice(0, 20).toUpperCase()}`;
}

export async function POST(request: Request) {
  if (process.env.CHECKOUT_ENABLED !== "true") {
    return NextResponse.json(
      { error: "Checkout is temporarily unavailable. Please check back soon." },
      { status: 503 },
    );
  }

  try {
    const json = await request.json().catch(() => null);
    const parsed = checkoutSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: "Please check the checkout fields." }, { status: 400 });
    }

    const product = await getStoreProductBySlug(parsed.data.productSlug);

    if (!product || !product.available) {
      return NextResponse.json({ error: "This product is unavailable." }, { status: 404 });
    }

    const variation = product.variations.find(
      (item) => item.id === parsed.data.variationId && item.active && item.available,
    );

    if (!variation) {
      return NextResponse.json({ error: "This product option is unavailable." }, { status: 404 });
    }

    if (Math.round(variation.priceMyr * 100) < 100) {
      return NextResponse.json({ error: "FPX requires an order total of at least RM1.00. Please select another option." }, { status: 400 });
    }

    const missingField = product.requiredFields.find((field) => !parsed.data.fieldValues[field.key]);

    if (missingField) {
      return NextResponse.json({ error: `${missingField.label} is required.` }, { status: 400 });
    }

    const orderId = createOrderId();
    await createPendingOrder({
      orderId,
      product,
      variation,
      customerName: parsed.data.customerName,
      customerEmail: parsed.data.customerEmail,
      whatsapp: parsed.data.whatsapp,
      fieldValues: parsed.data.fieldValues,
    });

    const payment = await createToyyibPayBill({
      orderId,
      product,
      variation,
      customerName: parsed.data.customerName,
      customerEmail: parsed.data.customerEmail,
      whatsapp: parsed.data.whatsapp,
    });
    await attachPaymentReference(orderId, payment.providerReference);

    return NextResponse.json({
      orderId,
      paymentUrl: payment.paymentUrl,
      paymentSetupRequired: payment.paymentSetupRequired,
    });
  } catch (error) {
    console.error("Checkout failed", {
      message: error instanceof Error ? error.message : "Unknown checkout error",
    });

    return NextResponse.json(
      { error: "Payment could not be started. Please try again or contact Kaitou support." },
      { status: 502 },
    );
  }
}
