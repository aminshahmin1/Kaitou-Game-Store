import { createSupabaseAdminClient } from "./supabase/admin";
import { createFazerCardsOrder } from "./integrations/fazercards";
import { allocateFundingForOrder } from "./revenue";
import type { OrderStatus, Product, ProductVariation, RequiredField } from "./types";

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
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return;
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
    amount_myr: input.variation.priceMyr,
    cost_usd: input.variation.costUsd,
    cost_myr: input.variation.costMyr,
    payment_fee_myr: 1,
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
    return;
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
      "id, order_number, status, payment_reference, amount_myr, customer_fields, fulfillment_reference, paid_at, products(id, slug, title, type, category, game, description, image_tone, region, delivery_type, fazercards_product_id, required_fields, active, available), product_variations(id, title, sku, fazercards_sku, cost_usd, price_myr, cost_myr, active, available)",
    )
    .eq("order_number", input.orderId)
    .maybeSingle();

  if (orderError) {
    throw new Error(orderError.message);
  }

  if (!order) {
    return { processed: false, reason: "order_not_found" };
  }

  if (order.payment_reference && input.billCode && order.payment_reference !== input.billCode) {
    return { processed: false, reason: "bill_code_mismatch" };
  }

  if (input.amountMyr !== null && Math.abs(Number(order.amount_myr) - input.amountMyr) > 0.01) {
    await supabase
      .from("orders")
      .update({
        status: "review",
        payment_reference: input.billCode || order.payment_reference,
        payment_raw: input.rawPayload,
        paid_at: new Date().toISOString(),
        failure_reason: "Payment amount did not match the order total.",
      })
      .eq("id", order.id);

    return { processed: false, reason: "amount_mismatch" };
  }

  if (input.paymentStatus === "pending") {
    const { error } = await supabase
      .from("orders")
      .update({
        payment_reference: input.billCode || order.payment_reference,
        payment_raw: input.rawPayload,
      })
      .eq("id", order.id);

    if (error) {
      throw new Error(error.message);
    }

    return { processed: true, reason: "payment_pending" };
  }

  if (input.paymentStatus === "failed") {
    const { error } = await supabase
      .from("orders")
      .update({
        status: "failed",
        payment_reference: input.billCode || order.payment_reference,
        payment_raw: input.rawPayload,
        failure_reason: String(input.rawPayload.reason ?? "Payment failed."),
      })
      .eq("id", order.id);

    if (error) {
      throw new Error(error.message);
    }

    return { processed: true, reason: "payment_failed" };
  }

  if (order.fulfillment_reference) {
    const paidAt = order.paid_at ?? new Date().toISOString();
    const { error } = await supabase
      .from("orders")
      .update({
        status: order.status === "pending_payment" ? "processing" : order.status,
        payment_reference: input.billCode || order.payment_reference,
        payment_raw: input.rawPayload,
        paid_at: paidAt,
      })
      .eq("id", order.id);

    if (error) {
      throw new Error(error.message);
    }

    await allocateFundingForOrder(order.id).catch((allocationError) => {
      console.error("Order profit allocation skipped", {
        orderId: order.order_number,
        message: allocationError instanceof Error ? allocationError.message : "Unknown allocation error",
      });
    });

    return { processed: true, reason: "already_fulfilled" };
  }

  const paidAt = order.paid_at ?? new Date().toISOString();
  const { error } = await supabase
    .from("orders")
    .update({
      status: "processing",
      payment_reference: input.billCode || null,
      payment_raw: input.rawPayload,
      paid_at: paidAt,
    })
    .eq("id", order.id);

  if (error) {
    throw new Error(error.message);
  }

  await allocateFundingForOrder(order.id).catch((allocationError) => {
    console.error("Order profit allocation skipped", {
      orderId: order.order_number,
      message: allocationError instanceof Error ? allocationError.message : "Unknown allocation error",
    });
  });

  try {
    const fulfillment = await createFazerCardsOrder({
      orderId: input.orderId,
      product: mapOrderProduct(order.products),
      variation: mapOrderVariation(order.product_variations),
      fieldValues: order.customer_fields ?? {},
    });

    const { error: fulfillmentError } = await supabase
      .from("orders")
      .update({
        status: fulfillment.status,
        fulfillment_reference: fulfillment.providerReference,
        fulfillment_raw: fulfillment.raw ?? {
          message: fulfillment.message,
          setupRequired: fulfillment.setupRequired,
        },
        failure_reason: fulfillment.status === "review" ? fulfillment.message : null,
      })
      .eq("id", order.id);

    if (fulfillmentError) {
      throw new Error(fulfillmentError.message);
    }

    return { processed: true, reason: "fulfilled", fulfillmentStatus: fulfillment.status };
  } catch (fulfillmentError) {
    const message =
      fulfillmentError instanceof Error ? fulfillmentError.message : "FazerCards fulfillment failed.";

    const { error: reviewError } = await supabase
      .from("orders")
      .update({
        status: "review",
        failure_reason: message,
        fulfillment_raw: { error: message },
      })
      .eq("id", order.id);

    if (reviewError) {
      throw new Error(reviewError.message);
    }

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
  const phoneMatches = normalizePhone(String(data.customer_whatsapp)) === normalizedContactPhone;

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
    failureReason:
      data.status === "failed" || data.status === "review" ? (data.failure_reason as string | null) : null,
  };
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function getRelationTitle(value: unknown) {
  if (Array.isArray(value)) {
    return typeof value[0]?.title === "string" ? value[0].title : null;
  }

  return value && typeof value === "object" && "title" in value && typeof value.title === "string"
    ? value.title
    : null;
}

function mapOrderProduct(row: unknown): Product {
  const product = Array.isArray(row) ? row[0] : row;

  if (!product || typeof product !== "object") {
    throw new Error("Order product is missing.");
  }

  const record = product as Record<string, unknown>;

  return {
    id: String(record.id),
    slug: String(record.slug),
    title: String(record.title),
    type: record.type as Product["type"],
    category: record.category as Product["category"],
    game: String(record.game),
    description: typeof record.description === "string" ? record.description : null,
    region: record.region as Product["region"],
    deliveryType: record.delivery_type as Product["deliveryType"],
    imageTone: String(record.image_tone),
    active: Boolean(record.active),
    available: Boolean(record.available),
    fazercardsProductId:
      typeof record.fazercards_product_id === "string" ? record.fazercards_product_id : null,
    requiredFields: (record.required_fields ?? []) as RequiredField[],
    variations: [],
  };
}

function mapOrderVariation(row: unknown): ProductVariation {
  const variation = Array.isArray(row) ? row[0] : row;

  if (!variation || typeof variation !== "object") {
    throw new Error("Order product variation is missing.");
  }

  const record = variation as Record<string, unknown>;

  return {
    id: String(record.id),
    title: String(record.title),
    sku: String(record.sku),
    fazercardsSku: typeof record.fazercards_sku === "string" ? record.fazercards_sku : null,
    costUsd: Number(record.cost_usd ?? 0),
    priceMyr: Number(record.price_myr),
    costMyr: Number(record.cost_myr),
    active: Boolean(record.active),
    available: Boolean(record.available),
  };
}
