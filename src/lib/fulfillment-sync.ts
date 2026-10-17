import "server-only";
import { createSupabaseAdminClient } from "./supabase/admin";
import { getFazerCardsOrder } from "./integrations/fazercards";

export async function reconcileProviderOrders() {
  const db = createSupabaseAdminClient();
  if (!db) throw new Error("Database is not configured.");
  const { data, error } = await db.from("orders")
    .select("id,fulfillment_reference,updated_at")
    .eq("status", "processing").not("paid_at", "is", null)
    .like("fulfillment_reference", "ord-%")
    .order("updated_at", { ascending: true }).limit(3);
  if (error) throw new Error("Could not load pending orders.");
  let updated = 0;
  let failed = 0;
  for (const order of data ?? []) {
    try {
      const result = await getFazerCardsOrder(order.fulfillment_reference);
      const { data: saved, error: updateError } = await db.from("orders").update({
        status: result.status,
        fulfillment_raw: result.raw,
        failure_reason: result.status === "review" ? result.message : null,
        updated_at: new Date().toISOString(),
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
