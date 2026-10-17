import "server-only";
import { createSupabaseAdminClient } from "./supabase/admin";
import { getFazerCardsOrder } from "./integrations/fazercards";

export async function reconcileProviderOrders() {
  const db = createSupabaseAdminClient();
  if (!db) throw new Error("Database is not configured.");
  const { data, error } = await db.from("orders")
    .select("id,fulfillment_reference,updated_at,cost_usd,supplier_cost_confirmed_at,profit_allocated_at")
    .eq("status", "processing").not("paid_at", "is", null)
    .like("fulfillment_reference", "ord-%")
    .order("updated_at", { ascending: true }).limit(3);
  if (error) throw new Error("Could not load pending orders.");
  let updated = 0;
  let failed = 0;
  for (const order of data ?? []) {
    try {
      const result = await getFazerCardsOrder(order.fulfillment_reference);
      const costLocked = Boolean(order.supplier_cost_confirmed_at || order.profit_allocated_at);
      const costConflict = costLocked && result.chargedUsd !== undefined
        && Math.round(Number(order.cost_usd) * 10000) !== Math.round(result.chargedUsd * 10000);
      const { data: saved, error: updateError } = await db.from("orders").update({
        status: costConflict ? "review" : result.status,
        fulfillment_raw: result.raw,
        failure_reason: costConflict ? "Supplier total changed after cost confirmation. Reconcile the debit before changing recorded profit."
          : result.status === "review" ? result.message : null,
        updated_at: new Date().toISOString(),
        ...(!costLocked && result.chargedUsd !== undefined && ["processing", "completed"].includes(result.status)
          ? { cost_usd: result.chargedUsd, supplier_cost_confirmed_at: new Date().toISOString() } : {}),
      }).eq("id", order.id).eq("status", "processing")
        .eq("fulfillment_reference", result.providerReference)
        .eq("updated_at", order.updated_at).select("id");
      if (updateError) throw new Error("Could not save supplier status.");
      updated += saved?.length ?? 0;
    } catch {
      failed++;
      // Move failed lookups behind untouched orders without changing payment or status.
      // Compare the loaded timestamp so a concurrent admin/poller update wins.
      const { error: retryError } = await db.from("orders")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", order.id).eq("status", "processing")
        .eq("fulfillment_reference", order.fulfillment_reference)
        .eq("updated_at", order.updated_at);
      if (retryError) throw new Error("Could not reschedule supplier status check.");
    }
  }
  return { updated, failed };
}
