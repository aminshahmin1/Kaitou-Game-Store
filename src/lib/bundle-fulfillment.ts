import "server-only";
import { createSupabaseAdminClient } from "./supabase/admin";
import { readFulfillmentSnapshot } from "./fulfillment-snapshot";
import { createFazerCardsOrder } from "./integrations/fazercards";
import { hasSupplierReservation } from "./supplier-credit";
import { allocateFundingForOrder } from "./revenue";

export async function reconcileNextBundle() {
  const db = createSupabaseAdminClient();
  if (!db) throw new Error("Database is not configured.");
  const { data, error } = await db.rpc("claim_bundle_order");
  if (error) throw new Error("Custom package queue is unavailable.");
  const order = data?.[0];
  if (!order) return { updated: 0 };
  const save = (patch: Record<string, unknown>) => db.from("orders")
    .update({ ...patch, bundle_lease_until: null }).eq("id", order.id).eq("status", "processing")
    .eq("fulfillment_reference", order.fulfillment_reference).eq("bundle_lease_until", order.bundle_lease_until)
    .select("id").maybeSingle();
  let result;
  try {
    const snapshot = readFulfillmentSnapshot(order.fulfillment_snapshot);
    if ((snapshot.variation.supplierQuantity ?? 1) < 2 || order.fulfillment_reference !== `bundle-${order.order_number}`) {
      throw new Error("Custom package identity is invalid.");
    }
    if (!await hasSupplierReservation(order.id)) throw new Error("Custom package has no supplier reservation.");
    result = await createFazerCardsOrder({ orderId: order.order_number, product: snapshot.product,
      variation: snapshot.variation, fieldValues: order.customer_fields ?? {}, previous: order.fulfillment_raw });
  } catch {
    const { error: saveError } = await save({ status: "review",
      failure_reason: "Custom package needs review. Check each supplier delivery before retrying or refunding." });
    if (saveError) throw new Error("Custom package needs recovery after its lease expires.");
    return { updated: 0, review: 1 };
  }
  const locked = Boolean(order.supplier_cost_confirmed_at || order.profit_allocated_at);
  const conflict = locked && result.chargedUsd !== undefined
    && Math.round(Number(order.cost_usd) * 10000) !== Math.round(result.chargedUsd * 10000);
  const confirmed = result.chargedUsd !== undefined && !conflict && ["processing", "completed"].includes(result.status);
  const { data: saved, error: saveError } = await save({ status: conflict ? "review" : result.status,
    fulfillment_raw: result.raw, failure_reason: conflict ? "Custom package debit differs from the confirmed cost. Reconcile before changing profit."
      : result.status === "review" ? result.message : null,
    ...(!locked && confirmed ? { cost_usd: result.chargedUsd, supplier_cost_confirmed_at: new Date().toISOString() } : {}),
  });
  if (saveError) throw new Error("Custom package progress could not be saved.");
  if (saved && confirmed) await allocateFundingForOrder(order.id).catch(() => undefined);
  return { updated: saved ? 1 : 0 };

}
