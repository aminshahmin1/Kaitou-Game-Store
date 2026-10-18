import "server-only";
import { createSupabaseAdminClient } from "./supabase/admin";

export type FundingCostBasis = { rate: number; label: string };

// One store-wide manual rate; funding fees do not change catalogue costs.
export async function getFundingCostBasis(): Promise<FundingCostBasis | null> {
  const db = createSupabaseAdminClient();
  if (!db) return null;
  const { data, error } = await db.from("integration_settings")
    .select("public_config").eq("id", "supplier-exchange-rate").maybeSingle();
  const rate = Number(data?.public_config?.usdMyr);
  if (error || !Number.isFinite(rate) || rate <= 0 || rate > 10000) {
    throw new Error("The store exchange rate could not be loaded.");
  }
  return { rate, label: "Manual USD/MYR exchange rate; funding fees excluded" };
}
