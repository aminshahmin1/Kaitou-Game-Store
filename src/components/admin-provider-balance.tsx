import { getFazerCardsBalance } from "@/lib/integrations/fazercards-balance";

export async function AdminProviderBalance() {
  const balance = await getFazerCardsBalance().catch(() => null);
  return <section className="border-b border-slate-200 py-5">
    <h2 className="text-sm font-semibold text-slate-600">FazerCards live balance</h2>
    <p className="mt-2 text-2xl font-bold">{balance ? `USD ${balance.balanceUsd.toFixed(4)}` : "Unavailable"}</p>
    <p className="mt-1 text-sm text-slate-500">{balance
      ? `Checked ${new Intl.DateTimeFormat("en-MY", { timeZone: "Asia/Kuala_Lumpur", dateStyle: "medium", timeStyle: "medium" }).format(new Date(balance.checkedAt))} MYT`
      : "The provider could not be reached. Purchases are temporarily unavailable."}</p>
  </section>;
}
