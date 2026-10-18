import "server-only";

import { createSupabaseAdminClient } from "./supabase/admin";
import type { BundleProgress } from "./integrations/fazercards-bundles";

type AdminOrderStatus = "processing" | "completed" | "failed" | "review" | "refunded";

type AdminOrderRow = {
  fulfillment_raw?: unknown;
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
  is_test_order: boolean;
  products: unknown;
  product_variations: unknown;
};

export type AdminOrder = {
  deliveries?: BundleProgress["children"];
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
  isTest: boolean;
};

const reviewStatuses: AdminOrderStatus[] = ["review", "failed", "refunded"];
const allowedStatuses: AdminOrderStatus[] = ["processing", "completed", "review", "failed", "refunded"];

export async function getReviewOrders(options: { allPaid?: boolean } = {}) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, customer_name, customer_email, customer_whatsapp, customer_fields, amount_myr, payment_reference, fulfillment_reference, fulfillment_raw, failure_reason, support_notes, refund_reference, created_at, updated_at, paid_at, is_test_order, products(title), product_variations(title)",
    )
    .in("status", options.allPaid ? allowedStatuses : reviewStatuses)
    .not("paid_at", "is", null)
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

  const { data: order, error: readError } = await supabase.from("orders")
    .select("id,status,paid_at,updated_at,refund_reference,support_notes,fulfillment_reference,bundle_lease_until")
    .eq("id", orderId).maybeSingle();
  if (readError) throw new Error("Could not load the order. Please try again.");
  if (!order) throw new Error("Order not found.");

  const nextStatus = input.status ?? order.status;
  if (input.status && input.status !== order.status && order.bundle_lease_until
    && new Date(order.bundle_lease_until).getTime() > Date.now()) {
    throw new Error("A package delivery is being checked. Wait for it to finish before changing status.");
  }
  if (input.status && input.status !== order.status) {
    if (!order.paid_at) throw new Error("Payment must be verified before changing order status.");
    if (order.status === "refunded") throw new Error("A refunded order cannot be reopened.");
    const supportNotes = "support_notes" in update ? update.support_notes : order.support_notes;
    if (nextStatus === "completed" && !supportNotes?.trim()) {
      throw new Error("Add support notes confirming delivery before marking this order completed.");
    }
    if (nextStatus === "processing" && order.fulfillment_reference?.startsWith("bundle-") && !supportNotes?.trim()) {
      throw new Error("Record why unconfirmed package deliveries should be retried. Successful deliveries are never repeated.");
    }
  }
  const refundReference = "refund_reference" in update ? update.refund_reference : order.refund_reference;
  if (nextStatus === "refunded" && !refundReference?.trim()) {
    throw new Error("Enter the reference for the completed customer refund first. This action does not transfer money.");
  }

  // Do not overwrite a callback, supplier poll or another operator's newer change.
  const { data: saved, error } = await supabase.from("orders")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("id", orderId).eq("status", order.status).eq("updated_at", order.updated_at)
    .select("id").maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!saved) throw new Error("This order changed while you were saving. Refresh it before trying again.");
}

function mapAdminOrder(row: AdminOrderRow): AdminOrder {
  const progress = row.fulfillment_raw as Partial<BundleProgress> | null;
  return {
    deliveries: progress?.kind === "bundle" && Array.isArray(progress.children) ? progress.children : undefined,
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
    isTest: row.is_test_order === true,
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
