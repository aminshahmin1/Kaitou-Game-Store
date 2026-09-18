import "server-only";

import { createSupabaseAdminClient } from "./supabase/admin";

type AdminOrderStatus = "processing" | "completed" | "failed" | "review" | "refunded";

type AdminOrderRow = {
  id: string;
  order_number: string;
  status: AdminOrderStatus;
  customer_name: string;
  customer_email: string;
  customer_whatsapp: string;
  customer_fields: Record<string, string> | null;
  amount_myr: string | number;
  payment_reference: string | null;
  fulfillment_reference: string | null;
  failure_reason: string | null;
  support_notes: string | null;
  refund_reference: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  products: unknown;
  product_variations: unknown;
};

export type AdminOrder = {
  id: string;
  orderNumber: string;
  status: AdminOrderStatus;
  customerName: string;
  customerEmail: string;
  customerWhatsapp: string;
  customerFields: Record<string, string>;
  amountMyr: number;
  productTitle: string | null;
  variationTitle: string | null;
  paymentReference: string | null;
  fulfillmentReference: string | null;
  failureReason: string | null;
  supportNotes: string | null;
  refundReference: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
};

const reviewStatuses: AdminOrderStatus[] = ["review", "failed", "refunded"];
const allowedStatuses: AdminOrderStatus[] = ["processing", "completed", "review", "failed", "refunded"];

export async function getReviewOrders() {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, customer_name, customer_email, customer_whatsapp, customer_fields, amount_myr, payment_reference, fulfillment_reference, failure_reason, support_notes, refund_reference, created_at, updated_at, paid_at, products(title), product_variations(title)",
    )
    .in("status", reviewStatuses)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data as AdminOrderRow[] | null ?? []).map(mapAdminOrder);
}

export async function updateAdminOrder(
  orderId: string,
  input: {
    status?: string;
    supportNotes?: string | null;
    failureReason?: string | null;
    refundReference?: string | null;
  },
) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const update: Record<string, string | null> = {};

  if (input.status) {
    if (!allowedStatuses.includes(input.status as AdminOrderStatus)) {
      throw new Error("Unsupported order status.");
    }
    update.status = input.status;
  }

  if ("supportNotes" in input) {
    update.support_notes = input.supportNotes?.trim() || null;
  }

  if ("failureReason" in input) {
    update.failure_reason = input.failureReason?.trim() || null;
  }

  if ("refundReference" in input) {
    update.refund_reference = input.refundReference?.trim() || null;
  }

  if (Object.keys(update).length === 0) {
    throw new Error("No order fields to update.");
  }

  const { error } = await supabase.from("orders").update(update).eq("id", orderId);

  if (error) {
    throw new Error(error.message);
  }
}

function mapAdminOrder(row: AdminOrderRow): AdminOrder {
  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerWhatsapp: row.customer_whatsapp,
    customerFields: row.customer_fields ?? {},
    amountMyr: Number(row.amount_myr),
    productTitle: getRelationTitle(row.products),
    variationTitle: getRelationTitle(row.product_variations),
    paymentReference: row.payment_reference,
    fulfillmentReference: row.fulfillment_reference,
    failureReason: row.failure_reason,
    supportNotes: row.support_notes,
    refundReference: row.refund_reference,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    paidAt: row.paid_at,
  };
}

function getRelationTitle(value: unknown) {
  if (Array.isArray(value)) {
    return typeof value[0]?.title === "string" ? value[0].title : null;
  }

  return value && typeof value === "object" && "title" in value && typeof value.title === "string"
    ? value.title
    : null;
}
