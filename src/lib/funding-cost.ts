import "server-only";
import { createSupabaseAdminClient } from "./supabase/admin";

export type FundingCostBasis = { rate: number; label: string };

// Product quotes are estimates, not historical order profit allocations.
export async function getFundingCostBasis(): Promise<FundingCostBasis | null> {
  const db = createSupabaseAdminClient();
  if (!db) return null;
  const { data, error } = await db.from("funding_batches")
    .select("effective_rate,usd_credited,opening_used_usd,order_funding_allocations(amount_usd)")
    .eq("provider", "fazercards")
    .order("topup_date", { ascending: true }).order("created_at", { ascending: true });
  if (error) throw new Error("Funding cost could not be loaded.");
  for (const batch of data ?? []) {
    const used = (batch.order_funding_allocations ?? []).reduce((sum, row) => sum + Number(row.amount_usd), 0);
    const rate = Number(batch.effective_rate);
    if (Number(batch.usd_credited) - Number(batch.opening_used_usd ?? 0) - used > 0.00005 && Number.isFinite(rate) && rate >= 0) {
      return { rate, label: "Estimated at next available funding batch rate" };
    }
  }
  if (data?.length) return null;
  const { data: opening, error: openingError } = await db.from("integration_settings")
    .select("public_config").eq("id", "fazercards-opening-cost").maybeSingle();
  if (openingError) throw new Error("Opening funding cost could not be loaded.");
  const config = opening?.public_config;
  const myr = Number(config?.totalMyr);
  const usd = Number(config?.creditedUsd);
  return Number.isFinite(myr) && myr >= 0 && Number.isFinite(usd) && usd > 0
    ? { rate: myr / usd, label: "Estimated opening funding cost, including fees" }
    : null;
}
