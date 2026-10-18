import "server-only";
import { createSupabaseAdminClient } from "./supabase/admin";
import { readFulfillmentSnapshot } from "./fulfillment-snapshot";
import { createFazerCardsOrder } from "./integrations/fazercards";
import { allocateFundingForOrder } from "./revenue";
import { hasSupplierReservation } from "./supplier-credit";

export async function recoverInterruptedFulfillment() {
  const db = createSupabaseAdminClient();
  if (!db) throw new Error("Database is not configured.");
  const cutoff = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: order, error } = await db.from("orders")
    .select("id,order_number,customer_fields,fulfillment_snapshot,updated_at,cost_usd,supplier_cost_confirmed_at,profit_allocated_at")
    .eq("status", "processing").not("paid_at", "is", null).is("fulfillment_reference", null)
    .lt("updated_at", cutoff).order("updated_at", { ascending: true }).limit(1).maybeSingle();
  if (error) throw new Error("Could not load interrupted fulfillment.");
  if (!order) return { recovered: 0, review: 0 };

  const claimedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await db.from("orders")
    .update({ updated_at: claimedAt, ...(order.fulfillment_snapshot?.variation?.supplierQuantity > 1
      ? { bundle_lease_until: new Date(Date.now() + 2 * 60_000).toISOString() } : {}) }).eq("id", order.id).eq("updated_at", order.updated_at)
    .eq("status", "processing").not("paid_at", "is", null).is("fulfillment_reference", null)
    .select("updated_at").maybeSingle();
  if (claimError) throw new Error("Could not claim interrupted fulfillment.");
  if (!claimed) return { recovered: 0, review: 0 };

  // The DB trigger owns updated_at; use its returned value as the claim token.
  const save = (patch: Record<string, unknown>) => db.from("orders").update({ ...patch, bundle_lease_until: null })
    .eq("id", order.id).eq("status", "processing").is("fulfillment_reference", null)
    .eq("updated_at", claimed.updated_at).select("id").maybeSingle();
  let result;
  try {
    const snapshot = readFulfillmentSnapshot(order.fulfillment_snapshot);
    if (!await hasSupplierReservation(order.id)) throw new Error("No supplier reservation exists for this order.");
    result = await createFazerCardsOrder({
      orderId: order.order_number, product: snapshot.product, variation: snapshot.variation,
      fieldValues: order.customer_fields ?? {},
    });
  } catch {
    const { data, error: saveError } = await save({ status: "review",
      failure_reason: "Interrupted fulfillment could not be confirmed. Check supplier history before any manual delivery or refund." });
    if (saveError) throw new Error("Could not save recovery review.");
    return { recovered: 0, review: data ? 1 : 0 };
  }

  const locked = Boolean(order.supplier_cost_confirmed_at || order.profit_allocated_at);
  const conflict = locked && result.chargedUsd !== undefined
    && Math.round(Number(order.cost_usd) * 10000) !== Math.round(result.chargedUsd * 10000);
  const confirmed = result.chargedUsd !== undefined && ["processing", "completed"].includes(result.status);
  const { data: saved, error: saveError } = await save({
    status: conflict ? "review" : result.status,
    fulfillment_reference: result.providerReference, fulfillment_raw: result.raw ?? {},
    failure_reason: conflict ? "Recovered supplier cost differs from the recorded debit. Reconcile before changing profit."
      : result.status === "review" ? result.message : null,
    ...(!locked && confirmed ? { cost_usd: result.chargedUsd, supplier_cost_confirmed_at: new Date().toISOString() } : {}),
  });
  // A failed save remains processing, so a later worker can replay the same key.
  if (saveError) throw new Error("Could not save recovered supplier order.");
  if (!saved) return { recovered: 0, review: 0 };
  if (confirmed && !conflict) await allocateFundingForOrder(order.id).catch(() => undefined);
  return { recovered: 1, review: conflict || result.status === "review" ? 1 : 0 };
}
