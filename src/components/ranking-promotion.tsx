"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { X, Trophy, ArrowRight, ShoppingBag } from "lucide-react";

export function RankingPromotion() {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    try { if (sessionStorage.getItem("kaitou-ranking-promo-v1")) return; } catch { /* Continue without persistent storage. */ }
    dialog.current?.showModal();
  }, []);
  function dismissed() {
    try { sessionStorage.setItem("kaitou-ranking-promo-v1", "seen"); } catch { /* Closing still works. */ }
  }
  function close() { dismissed(); dialog.current?.close(); }
  return <dialog ref={dialog} onClose={dismissed} aria-labelledby="ranking-promo-title"
    onClick={(event) => { if (event.target === event.currentTarget) close(); }}
    className="ranking-promo m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-lg border border-cyan-300/40 bg-[#071225] p-0 text-white shadow-2xl backdrop:bg-black/70" data-dark-surface>
    <div className="relative px-7 py-8 text-center">
      <button type="button" aria-label="Close ranking promotion" title="Close" autoFocus onClick={close}
        className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-md border border-white/30"><X className="h-5 w-5" /></button>
      <Image src="/brand/logo-current.png" alt="Kaitou Game Store" width={160} height={160} className="mx-auto h-32 w-32 rounded-full" />
      <Trophy className="mx-auto mt-5 h-10 w-10 text-amber-300" />
      <h2 id="ranking-promo-title" className="mt-4 text-3xl font-bold leading-tight">Top up.<br />Get ranked.</h2>
      <p className="mt-4 text-sm leading-6 text-slate-200">Every eligible currency top-up adds to your game account’s total. Climb the leaderboard with Kaitou.</p>
      <Link href="/leaderboard" onClick={close} className="mt-6 flex min-h-12 items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 py-3 font-bold text-slate-950">View rankings<ArrowRight className="h-4 w-4" /></Link>
      <button type="button" onClick={close} className="mt-3 inline-flex min-h-11 items-center gap-2 px-3 py-2 text-sm font-semibold text-white"><ShoppingBag className="h-4 w-4" />Continue shopping</button>
      <p className="mt-4 text-xs leading-5 text-slate-300">Completed currency top-ups only. Packs and passes are excluded. Player IDs stay masked.</p>
    </div>
  </dialog>;
}
