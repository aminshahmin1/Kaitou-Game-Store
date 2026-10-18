import { createSupabaseAdminClient } from "./supabase/admin";
import { createFazerCardsOrder } from "./integrations/fazercards";
import { allocateFundingForOrder } from "./revenue";
import { getCheckoutPricing } from "./checkout-pricing";
import { createFulfillmentSnapshot, readFulfillmentSnapshot } from "./fulfillment-snapshot";
import type { OrderStatus, Product, ProductVariation } from "./types";

type CreatePendingOrderInput = {
  orderId: string;
  product: Product;
  variation: ProductVariation;
  customerName: string;
  customerEmail: string;
  whatsapp: string;
  fieldValues: Record<string, string>;
};

export async function createPendingOrder(input: CreatePendingOrderInput) {
  const pricing = getCheckoutPricing(input.variation.priceMyr);
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Order storage is not configured.");
  }

  const { error } = await supabase.from("orders").insert({
    order_number: input.orderId,
    product_id: input.product.id,
    product_variation_id: input.variation.id,
    status: "pending_payment",
    customer_name: input.customerName,
    customer_email: input.customerEmail,
    customer_whatsapp: input.whatsapp,
    customer_fields: input.fieldValues,
    amount_myr: pricing.totalMyr,
    product_amount_myr: pricing.subtotalMyr,
    payment_surcharge_myr: pricing.feeMyr,
    cost_usd: input.variation.costUsd,
    cost_myr: input.variation.costMyr,
    payment_fee_myr: 1,
    fulfillment_snapshot: createFulfillmentSnapshot(input.product, input.variation),
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function attachPaymentReference(orderId: string, paymentReference: string | null) {
  if (!paymentReference) {
    return;
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Order storage is not configured.");
  }

  const { error } = await supabase
    .from("orders")
    .update({ payment_reference: paymentReference })
    .eq("order_number", orderId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markOrderPaymentCallback(input: {
  orderId: string;
  billCode: string;
  paymentStatus: "success" | "pending" | "failed";
  amountMyr: number | null;
  rawPayload: Record<string, unknown>;
}) {
  const supabase = createSupabaseAdminClient();

  if (!supabase || !input.orderId) {
    return { processed: false, reason: "missing_supabase_or_order" };
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, payment_reference, amount_myr, customer_fields, fulfillment_reference, fulfillment_snapshot, paid_at",
    )
    .eq("order_number", input.orderId)
    .maybeSingle();

  if (orderError) {
    throw new Error(orderError.message);
  }

  if (!order) {
    return { processed: false, reason: "order_not_found" };
  }

  if (!order.payment_reference || !input.billCode || order.payment_reference !== input.billCode) {
    return { processed: false, reason: "bill_code_mismatch" };
  }

  if (order.paid_at || order.fulfillment_reference || !["pending_payment", "failed"].includes(order.status)) {
    return { processed: true, reason: "already_processed" };
  }

  if (input.paymentStatus === "success" && (input.amountMyr === null || !Number.isFinite(input.amountMyr))) {
    return { processed: false, reason: "missing_amount" };
  }

  if (input.paymentStatus === "success" && Math.round(Number(order.amount_myr) * 100) !== Math.round(input.amountMyr! * 100)) {
    const { error } = await supabase
      .from("orders")
      .update({
        status: "review",
        payment_reference: input.billCode || order.payment_reference,
        payment_raw: input.rawPayload,
        paid_at: new Date().toISOString(),
        failure_reason: "Payment amount did not match the order total.",
      })
      .eq("id", order.id)
      .is("paid_at", null)
      .in("status", ["pending_payment", "failed"]);
    if (error) throw new Error(error.message);

    return { processed: false, reason: "amount_mismatch" };
  }

  if (input.paymentStatus === "pending") {
    const { error } = await supabase
      .from("orders")
      .update({
        payment_reference: input.billCode || order.payment_reference,
        payment_raw: input.rawPayload,
      })
      .eq("id", order.id)
      .is("paid_at", null)
      .in("status", ["pending_payment", "failed"]);

    if (error) {
      throw new Error(error.message);
    }

    return { processed: true, reason: "payment_pending" };
  }

  if (input.paymentStatus === "failed") {
    const { error } = await supabase
      .from("orders")
      .update({
        status: "pending_payment",
        payment_reference: input.billCode || order.payment_reference,
        payment_raw: input.rawPayload,
        failure_reason: String(input.rawPayload.reason ?? "Payment failed."),
      })
      .eq("id", order.id)
      .is("paid_at", null)
      .in("status", ["pending_payment", "failed"]);

    if (error) {
      throw new Error(error.message);
    }

    return { processed: true, reason: "payment_failed" };
  }

  const paidAt = order.paid_at ?? new Date().toISOString();
  // Claim the first confirmed payment atomically before any supplier purchase.
  const { data: claimed, error } = await supabase
    .from("orders")
    .update({
      status: "processing",
      payment_reference: input.billCode || null,
      payment_raw: input.rawPayload,
      paid_at: paidAt,
    })
    .eq("id", order.id)
    .is("paid_at", null)
    .in("status", ["pending_payment", "failed"])
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!claimed) return { processed: true, reason: "already_processed" };

  try {
    const snapshot = readFulfillmentSnapshot(order.fulfillment_snapshot);
    const fulfillment = await createFazerCardsOrder({
      orderId: input.orderId,
      product: snapshot.product,
      variation: snapshot.variation,
      fieldValues: order.customer_fields ?? {},
    });

    const { data: fulfilledOrder, error: fulfillmentError } = await supabase
      .from("orders")
      .update({
        status: fulfillment.status,
        fulfillment_reference: fulfillment.providerReference,
        fulfillment_raw: fulfillment.raw ?? {
          message: fulfillment.message,
          setupRequired: fulfillment.setupRequired,
        },
        failure_reason: fulfillment.status === "review" ? fulfillment.message : null,
        ...(fulfillment.chargedUsd !== undefined && ["processing", "completed"].includes(fulfillment.status)
          ? { cost_usd: fulfillment.chargedUsd, supplier_cost_confirmed_at: new Date().toISOString() } : {}),
      })
      .eq("id", order.id)
      .eq("status", "processing")
      .is("fulfillment_reference", null)
      .select("id")
      .maybeSingle();

    if (fulfillmentError) {
      throw new Error(fulfillmentError.message);
    }

    if (!fulfilledOrder) return { processed: true, reason: "order_changed_during_fulfillment" };

    if (fulfillment.chargedUsd !== undefined && ["processing", "completed"].includes(fulfillment.status)) {
      await allocateFundingForOrder(order.id).catch(() => {
        console.error("Confirmed supplier cost is awaiting funding allocation", { orderId: order.order_number });
      });
    }

    return { processed: true, reason: "fulfilled", fulfillmentStatus: fulfillment.status };
  } catch (fulfillmentError) {
    const message =
      fulfillmentError instanceof Error ? fulfillmentError.message : "FazerCards fulfillment failed.";

    const { data: reviewOrder, error: reviewError } = await supabase
      .from("orders")
      .update({
        status: "review",
        failure_reason: message,
        fulfillment_raw: { error: message },
      })
      .eq("id", order.id)
      .eq("status", "processing")
      .is("fulfillment_reference", null)
      .select("id")
      .maybeSingle();

    if (reviewError) {
      throw new Error(reviewError.message);
    }

    if (!reviewOrder) return { processed: true, reason: "order_changed_during_fulfillment" };

    return { processed: true, reason: "fulfillment_review" };
  }
}

export async function lookupPublicOrder(input: { orderNumber: string; contact: string }) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("orders")
    .select(
      "order_number, status, customer_email, customer_whatsapp, amount_myr, created_at, updated_at, failure_reason, products(title), product_variations(title)",
    )
    .eq("order_number", input.orderNumber.trim())
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data || data.status === "pending_payment") {
    return null;
  }

  const contact = input.contact.trim().toLowerCase();
  const normalizedContactPhone = normalizePhone(contact);
  const emailMatches = String(data.customer_email).toLowerCase() === contact;
  const phoneMatches = normalizedContactPhone.length >= 8 && normalizePhone(String(data.customer_whatsapp)) === normalizedContactPhone;

  if (!emailMatches && !phoneMatches) {
    return null;
  }

  return {
    orderNumber: data.order_number as string,
    status: data.status as OrderStatus,
    productTitle: getRelationTitle(data.products),
    variationTitle: getRelationTitle(data.product_variations),
    amountMyr: Number(data.amount_myr),
    updatedAt: data.updated_at as string,
    failureReason: data.status === "failed" || data.status === "review"
      ? "Your order needs support review. Please contact Kaitou with your order ID." : null,
  };
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("0") ? `6${digits}` : digits;
}

function getRelationTitle(value: unknown) {
  if (Array.isArray(value)) {
    return typeof value[0]?.title === "string" ? value[0].title : null;
  }

  return value && typeof value === "object" && "title" in value && typeof value.title === "string"
    ? value.title
    : null;
}

