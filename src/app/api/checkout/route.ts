import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { createToyyibPayBill } from "@/lib/integrations/toyyibpay";
import { attachPaymentReference, createPendingOrder } from "@/lib/orders";
import { getStoreProductBySlug } from "@/lib/products";
import { checkoutSchema } from "@/lib/validation";
import { getCheckoutPricing } from "@/lib/checkout-pricing";
import { validateCheckoutFields } from "@/lib/checkout-fields";
import { getAdminApiSession } from "@/lib/auth/admin-api";
import { guardRequest } from "@/lib/request-guard";
import { normalizeSteamInvite } from "@/lib/steam-pricing";

function createOrderId() {
  return `KGS-${randomUUID().replace(/-/g, "").slice(0, 20).toUpperCase()}`;
}

export async function POST(request: Request) {
  let launchTest = false;
  const candidate = await request.clone().json().catch(() => null);
  if (candidate?.launchTest === true) {
    if (request.headers.get("origin") !== new URL(request.url).origin || (await getAdminApiSession())?.role !== "owner") {
      return NextResponse.json({ error: "Owner access required for a launch test." }, { status: 403 });
    }
    launchTest = true;
  }
  if (process.env.CHECKOUT_ENABLED !== "true" && !launchTest) {
    return NextResponse.json(
      { error: "Checkout is temporarily unavailable. Please check back soon." },
      { status: 503 },
    );
  }

  try {
    const blocked = await guardRequest(request, "checkout");
    if (blocked) return blocked;
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

    if (product.type === "steam_gift_game" && (parsed.data.expectedPriceMyr === undefined || Math.round(parsed.data.expectedPriceMyr * 100) !== Math.round(variation.priceMyr * 100))) {
      return NextResponse.json({ error: "The game price changed. Refresh the game page and review the updated price before paying." }, { status: 409 });
    }

    const pricing = getCheckoutPricing(variation.priceMyr);
    if (Math.round(pricing.totalMyr * 100) < 100) {
      return NextResponse.json({ error: "FPX requires an order total of at least RM1.00. Please select another option." }, { status: 400 });
    }

    const customerFields = validateCheckoutFields(product.requiredFields, parsed.data.fieldValues);
    if (!customerFields.success) {
      return NextResponse.json({ error: customerFields.error }, { status: 400 });
    }
    if (product.type === "steam_gift_game") {
      try { customerFields.values.steam_invite_url = normalizeSteamInvite(customerFields.values.steam_invite_url ?? ""); }
      catch { return NextResponse.json({ error: "Use a valid Steam friend invite link starting with https://s.team/p/." }, { status: 400 }); }
    }

    const orderId = createOrderId();
    const pending = await createPendingOrder({
      orderId,
      product,
      variation,
      customerName: parsed.data.customerName,
      customerEmail: parsed.data.customerEmail,
      whatsapp: parsed.data.whatsapp,
      fieldValues: customerFields.values,
      isTest: launchTest,
    });

    const payment = await createToyyibPayBill({
      orderId,
      product,
      variation,
      customerName: parsed.data.customerName,
      customerEmail: parsed.data.customerEmail,
      whatsapp: parsed.data.whatsapp,
      expiresAt: pending.expiresAt,
    });
    await attachPaymentReference(orderId, payment.providerReference);

    return NextResponse.json({
      orderId,
      paymentUrl: payment.paymentUrl,
      paymentSetupRequired: payment.paymentSetupRequired,
      pricing,
      expiresAt: pending.expiresAt,
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
