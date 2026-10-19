import Link from "next/link";
import { connection } from "next/server";
import { Trophy, Medal, ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getCurrencyRankings, getRankingGroups, type RankingRow } from "@/lib/currency-ranking";

export const metadata = { title: "Top-up rankings | Kaitou Game Store" };

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ game?: string }> }) {
  await connection();
  const params = await searchParams;
  let rows: RankingRow[] = [], unavailable = false;
  let configuredGroups: string[] = [];
  try { [rows, configuredGroups] = await Promise.all([getCurrencyRankings(), getRankingGroups()]); } catch { unavailable = true; }
  const groups = [...new Set([...configuredGroups, ...rows.map((row) => `${row.game} | ${row.unit}`)])];
  const selected = groups.includes(params.game ?? "") ? params.game! : groups[0];
  const ranking = rows.filter((row) => `${row.game} | ${row.unit}` === selected);
  const formatter = new Intl.NumberFormat("en-MY");
  return <div className="trust-surface min-h-screen">
    <SiteHeader />
    <main className="mx-auto max-w-5xl px-5 py-10">
      <div className="flex items-center gap-3"><Trophy className="h-8 w-8 shrink-0 text-sky-600" /><h1 className="font-display text-4xl font-bold">Top-up rankings</h1></div>
      <p className="mt-3 text-sm text-slate-600">All-time currency top-ups</p>
      {groups.length > 0 && <nav aria-label="Game rankings" className="mt-7 flex flex-wrap gap-5 border-b border-slate-200">
        {groups.map((group) => <Link key={group} href={`/leaderboard?game=${encodeURIComponent(group)}`}
          aria-current={group === selected ? "page" : undefined}
          className={`break-words border-b-2 py-3 text-sm font-semibold ${group === selected ? "border-sky-600 text-sky-700" : "border-transparent text-slate-600"}`}>{group}</Link>)}
      </nav>}
      {ranking.length > 0 ? <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[300px] border-collapse text-sm">
        <caption className="sr-only">{selected}</caption>
        <thead><tr className="border-b border-slate-300 text-left text-slate-600"><th className="w-14 py-4 pr-3">Rank</th><th className="px-3 py-4">Player ID</th><th className="py-4 pl-3 text-right">Total {ranking[0].unit}</th></tr></thead>
        <tbody>{ranking.map((row, index) => <tr key={`${row.player}-${index}`} className="border-b border-slate-200">
          <td className="py-5 pr-3 font-bold text-sky-700">{index < 3 ? <span className={`inline-flex items-center gap-1 ${["text-amber-700", "text-slate-600", "text-orange-800"][index]}`} aria-label={`Rank ${index + 1}`}><Medal className="h-7 w-7" /><span>{index + 1}</span></span> : index + 1}</td><td className="px-3 py-5 font-mono">{row.player}</td><td className="py-5 pl-3 text-right font-bold tabular-nums">{formatter.format(row.units)}</td>
        </tr>)}</tbody>
      </table></div> : <div role="status" className="mt-8 border-y border-slate-200 py-10 text-slate-600"><p>{unavailable ? "Rankings are temporarily unavailable. Please check back soon." : "Be the first to claim a place on this leaderboard."}</p>{!unavailable && <Link href="/#products" className="mt-4 inline-flex items-center gap-2 font-semibold text-sky-800">Top up and get ranked<ArrowRight className="h-4 w-4" /></Link>}</div>}
      <p className="mt-6 text-xs leading-6 text-slate-500">Completed currency top-ups only. Packs, passes, refunded orders and test purchases are excluded. Player IDs are masked.</p>
    </main><SiteFooter />
  </div>;
}
