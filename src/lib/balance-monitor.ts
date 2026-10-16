import "server-only";
import { createSupabaseAdminClient } from "./supabase/admin";
import { getFazerCardsBalance } from "./integrations/fazercards-balance";
import { sendAdminEmail } from "./integrations/email";
import { getAdminProducts } from "./products";
import { refreshSupplierPrices } from "./integrations/fazercards-pricing";
import { getFundingCostBasis } from "./funding-cost";
import { estimateCostMyr } from "./cost-conversion";

export async function checkBalanceAndNotify() {
  const db = createSupabaseAdminClient();
  if (!db) throw new Error("Database is not configured.");
  const balance = await getFazerCardsBalance();
  const basis = await getFundingCostBasis();
  const published = (await getAdminProducts()).filter((p) => p.active && p.available);
  const refreshed = await refreshSupplierPrices(published);
  if (refreshed.some((p) => !p.available)) throw new Error("Supplier pricing is unavailable.");
  for (const product of refreshed) {
    for (const variation of product.variations) {
      const { error: priceError } = await db.from("product_variations")
        .update({ cost_usd: variation.costUsd,
          ...(basis ? { cost_myr: estimateCostMyr(variation.costUsd, basis.rate) } : {}),
        }).eq("id", variation.id);
      if (priceError) throw new Error("Could not sync supplier cost.");
    }
  }
  const { data, error } = await db.from("product_variations")
    .select("id,title,cost_usd,products!inner(title,active,available)")
    .eq("active", true).eq("available", true)
    .eq("products.active", true).eq("products.available", true)
    .gt("cost_usd", balance.balanceUsd);
  if (error) throw new Error("Could not check product funding.");
  const blocked = data ?? [];
  const now = new Date().toISOString();
  const { error: saveError } = await db.from("provider_balance_monitor").update({
    balance_usd: balance.balanceUsd, blocked_variations: blocked.length, checked_at: now,
    ...(blocked.length === 0 ? { last_alert_at: "1970-01-01T00:00:00Z" } : {}),
  }).eq("id", "fazercards");
  if (saveError) throw new Error("Could not save balance check.");
  if (!blocked.length) return { ...balance, blockedVariations: 0, notified: false };

  // A database lease prevents overlapping workers from sending the same alert.
  const lease = new Date(Date.now() + 10 * 60_000).toISOString();
  const cutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const { data: claimed, error: claimError } = await db.from("provider_balance_monitor")
    .update({ lease_until: lease }).eq("id", "fazercards")
    .lt("lease_until", now).lt("last_alert_at", cutoff).select("id").maybeSingle();
  if (claimError) throw new Error("Could not claim balance alert.");
  if (!claimed) return { ...balance, blockedVariations: blocked.length, notified: false };
  try {
    await sendAdminEmail("Kaitou: top up your FazerCards balance", [
      `Your FazerCards balance is USD ${balance.balanceUsd.toFixed(4)}.`,
      `${blocked.length} published product options exceed this balance and cannot be purchased.`,
      "Top up FazerCards to restore affordable options. Your selling prices will not change.",
      ...blocked.slice(0, 20).map((row) => `${row.title}: supplier cost USD ${Number(row.cost_usd).toFixed(4)}`),
      "Dashboard: https://kaitou.shop/dashboard",
    ].join("\n\n"));
    const { error: completeError } = await db.from("provider_balance_monitor")
      .update({ last_alert_at: new Date().toISOString(), lease_until: "1970-01-01T00:00:00Z" })
      .eq("id", "fazercards").eq("lease_until", lease);
    if (completeError) throw new Error("Could not record balance alert.");
    return { ...balance, blockedVariations: blocked.length, notified: true };
  } catch {
    // Keep the short lease after failure so SMTP outages do not trigger rapid retries.
    throw new Error("Balance alert delivery needs attention.");
  }
}
