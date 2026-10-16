import "server-only";
import { createSupabaseAdminClient } from "./supabase/admin";
import { getFazerCardsOrder } from "./integrations/fazercards";

export async function reconcileProviderOrders() {
  const db = createSupabaseAdminClient();
  if (!db) throw new Error("Database is not configured.");
  const { data, error } = await db.from("orders")
    .select("id,fulfillment_reference")
    .eq("status", "processing").not("paid_at", "is", null)
    .like("fulfillment_reference", "ord-%")
    .order("updated_at", { ascending: true }).limit(3);
  if (error) throw new Error("Could not load pending orders.");
  let updated = 0;
  let failed = 0;
  for (const order of data ?? []) {
    try {
      const result = await getFazerCardsOrder(order.fulfillment_reference);
      const { error: updateError } = await db.from("orders").update({
        status: result.status,
        fulfillment_raw: result.raw,
        failure_reason: result.status === "review" ? result.message : null,
        updated_at: new Date().toISOString(),
      }).eq("id", order.id).eq("status", "processing")
        .eq("fulfillment_reference", result.providerReference);
      if (updateError) throw new Error("Could not save supplier status.");
      updated++;
    } catch {
      failed++;
    }
  }
  return { updated, failed };
}
