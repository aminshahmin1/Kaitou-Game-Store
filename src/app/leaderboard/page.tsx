import Link from "next/link";
import { connection } from "next/server";
import { Trophy, Medal, ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getCurrencyRankings, getRankingGroups, type RankingRow } from "@/lib/currency-ranking";
import { RankingGameTabs } from "@/components/ranking-game-tabs";
import { getGameCurrency } from "@/lib/game-currency";

export const metadata = { title: "Top-up rankings | Kaitou Game Store" };

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ game?: string }> }) {
  await connection();
  const params = await searchParams;
  let rows: RankingRow[] = [], unavailable = false;
  let configuredGroups: string[] = [];
  try { [rows, configuredGroups] = await Promise.all([getCurrencyRankings(), getRankingGroups()]); } catch { unavailable = true; }
  const groups = [...new Set([...configuredGroups, ...rows.map((row) => `${row.game} | ${row.unit}`)])];
  const selected = groups.includes(params.game ?? "") ? params.game! : groups[0];
  const ranking = rows.filter((row) => `${row.game} | ${row.unit}` === selected).slice(0, 100);
  const selectedGame = selected ? getGameCurrency(selected).name : "";
  const formatter = new Intl.NumberFormat("en-MY");
  return <div className="ranking-surface min-h-screen">
    <SiteHeader />
    <main className="mx-auto max-w-5xl px-5 py-10">
      <div className="flex items-center gap-3"><Trophy className="h-8 w-8 shrink-0 text-sky-600" /><h1 className="font-display text-4xl font-bold">Top-up rankings</h1></div>
      <p className="ranking-muted mt-3 text-sm">All-time currency top-ups. Top 100 players per game.</p>
      {groups.length > 0 && <RankingGameTabs groups={groups} selected={selected} />}
      {selectedGame && <h2 className="mt-7 text-xl font-bold">{selectedGame}</h2>}
      {ranking.length > 0 ? <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[300px] border-collapse text-sm">
        <caption className="sr-only">{selected}</caption>
        <thead><tr className="ranking-muted ranking-rule border-b text-left"><th scope="col" className="w-14 py-4 pr-3">Rank</th><th scope="col" className="px-3 py-4">Player ID</th><th scope="col" className="py-4 pl-3 text-right">Total {ranking[0].unit}</th></tr></thead>
        <tbody>{ranking.map((row, index) => <tr key={`${row.player}-${index}`} className="ranking-rule border-b">
          <td className="py-5 pr-3 font-bold">{index < 3 ? <span className={`ranking-medal ranking-medal-${index + 1} inline-flex items-center gap-1`} aria-label={`Rank ${index + 1}`}><Medal className="h-7 w-7" /><span>{index + 1}</span></span> : index + 1}</td><td className="px-3 py-5 font-mono">{row.player}</td><td className="py-5 pl-3 text-right font-bold tabular-nums">{formatter.format(row.units)}</td>
        </tr>)}</tbody>
      </table></div> : <div role="status" className="ranking-muted ranking-rule mt-8 border-y py-10"><p>{unavailable ? "Rankings are temporarily unavailable. Please check back soon." : "Be the first to claim a place on this leaderboard."}</p>{!unavailable && <Link href="/#products" className="ranking-accent mt-4 inline-flex items-center gap-2 font-semibold">Top up and get ranked<ArrowRight className="h-4 w-4" /></Link>}</div>}
      <p className="ranking-muted mt-6 text-xs leading-6">Completed currency top-ups only. Packs, passes, refunded orders and test purchases are excluded. Player IDs are masked.</p>
    </main><SiteFooter />
  </div>;
}
