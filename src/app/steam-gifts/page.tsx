import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft, ArrowRight, Search, Gift } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { searchSteamLibrary } from "@/lib/steam-library";
import { steamBrowseLimited } from "@/lib/steam-browse-guard";
export const metadata = { title: "Steam Gifts Library | Kaitou Game Store", description: "Find Steam gift games, choose an edition and region, and pay in MYR." };
export default async function SteamLibraryPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await connection();
  const params = await searchParams, query = typeof params.q === "string" ? params.q.trim().slice(0,100) : "";
  const page = Math.max(1,Math.min(10000,Number.isSafeInteger(Number(params.page)) ? Number(params.page) : 1));
  let results: Awaited<ReturnType<typeof searchSteamLibrary>> = { items: [], total: 0, partial: false }, unavailable = false;
  const limited=await steamBrowseLimited();
  try { if (!limited) results = await searchSteamLibrary(query,page); else unavailable=true; } catch { unavailable = true; }
  const href = (next: number) => `/steam-gifts?${new URLSearchParams({ q: query, page: String(next) })}`;
  return <div className="trust-surface min-h-screen"><SiteHeader /><main className="mx-auto max-w-7xl px-5 py-10">
    <div className="flex items-center gap-3"><Gift className="h-8 w-8 text-sky-700" /><h1 className="font-display text-4xl font-bold">Steam Gifts Library</h1></div><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Find your next game. Choose the edition and receiving account region to see your MYR price.</p>
    <form action="/steam-gifts" className="mt-7 flex gap-3"><label className="sr-only" htmlFor="steam-search">Search Steam games</label><input id="steam-search" name="q" defaultValue={query} maxLength={100} placeholder="Search games, e.g. Palworld" className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-4 py-3 text-slate-950" /><button type="submit" className="inline-flex min-h-12 items-center gap-2 rounded-md bg-sky-800 px-4 py-3 font-bold text-white"><Search className="h-5 w-5" /><span>Search</span></button></form>
    <p className="mt-4 text-xs leading-6 text-slate-600">Paid base games only. Free games and standalone DLC are excluded. Edition and region availability are checked when you open a game. The RM1 FPX fee is shown separately at checkout.</p>
    {results.partial && <p role="status" className="mt-5 border-l-4 border-amber-400 pl-4 text-sm text-amber-900">Some matching games are still being checked. Please try your search again shortly.</p>}
    {results.items.length ? <><p className="mt-6 text-sm text-slate-600">{results.total.toLocaleString("en-MY")} {query ? "matching games" : "games"}</p><div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{results.items.map((game) => <Link key={game.appid} href={`/steam-gifts/${game.appid}`} prefetch={false} className="steam-game-link min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"><Image src={game.imageUrl} alt={`${game.name} game artwork`} width={460} height={215} unoptimized className="aspect-[460/215] w-full object-cover" /><div className="p-4"><h2 className="break-words text-base font-bold text-slate-950">{game.name}</h2><span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-sky-800">Choose edition<ArrowRight className="h-4 w-4" /></span></div></Link>)}</div></> : <div role="status" className="mt-8 border-y border-slate-200 py-12 text-slate-600">{limited ? "Please wait a moment before checking more games, then try again." : unavailable ? "The game library is temporarily unavailable. Please try again shortly." : query ? "No verified paid games match this search yet. Try the full game name or check back shortly." : "The game library is being updated. Please check back shortly."}</div>}
    <nav aria-label="Game library pages" className="mt-8 flex items-center justify-between gap-4">{page > 1 ? <Link href={href(page-1)} className="inline-flex min-h-11 items-center gap-2 font-semibold text-sky-800"><ArrowLeft className="h-4 w-4" />Previous</Link> : <span />}{page*24 < results.total && <Link href={href(page+1)} className="inline-flex min-h-11 items-center gap-2 font-semibold text-sky-800">Next<ArrowRight className="h-4 w-4" /></Link>}</nav>
  </main><SiteFooter /></div>;
}
