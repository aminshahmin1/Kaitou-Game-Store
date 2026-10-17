import { getFazerCardsBalance } from "@/lib/integrations/fazercards-balance";
import { getFundingCostBasis } from "@/lib/funding-cost";
import { AdminBalanceLive } from "./admin-balance-live";

export async function AdminProviderBalance() {
  const balance = await getFazerCardsBalance().catch(() => null);
  const basis = await getFundingCostBasis().catch(() => null);
  return <AdminBalanceLive initialBalance={balance} initialBasis={basis} />;
}
