import { createSupabaseAdminClient } from "./supabase/admin";
import type { Product, ProductVariation } from "./types";

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
    cost_myr: input.variation.costMyr,
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
  isPaid: boolean;
  rawPayload: Record<string, unknown>;
}) {
  const supabase = createSupabaseAdminClient();

  if (!supabase || !input.orderId) {
    return;
  }

  const { error } = await supabase
    .from("orders")
    .update({
      status: input.isPaid ? "processing" : "pending_payment",
      payment_reference: input.billCode || null,
      payment_raw: input.rawPayload,
    })
    .eq("order_number", input.orderId);

  if (error) {
    throw new Error(error.message);
  }
}
