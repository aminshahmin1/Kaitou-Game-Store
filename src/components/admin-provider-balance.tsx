import { getFazerCardsBalance } from "@/lib/integrations/fazercards-balance";
import { getFundingCostBasis } from "@/lib/funding-cost";
import { estimateCostMyr } from "@/lib/cost-conversion";

export async function AdminProviderBalance() {
  const balance = await getFazerCardsBalance().catch(() => null);
  const basis = await getFundingCostBasis().catch(() => null);
  return <section className="border-b border-slate-200 py-5">
    <h2 className="text-sm font-semibold text-slate-600">FazerCards live balance</h2>
    <p className="mt-2 text-2xl font-bold">{balance ? `USD ${balance.balanceUsd.toFixed(4)}` : "Unavailable"}</p>
    <p className="mt-1 text-sm text-slate-600">{balance && basis
      ? `Estimated value RM ${estimateCostMyr(balance.balanceUsd, basis.rate).toFixed(2)} at RM ${basis.rate.toFixed(4)} / USD. ${basis.label}.`
      : "MYR funding cost unavailable."}</p>
    <p className="mt-1 text-sm text-slate-500">{balance
      ? `Checked ${new Intl.DateTimeFormat("en-MY", { timeZone: "Asia/Kuala_Lumpur", dateStyle: "medium", timeStyle: "medium" }).format(new Date(balance.checkedAt))} MYT`
      : "The provider could not be reached. Purchases are temporarily unavailable."}</p>
  </section>;
}
