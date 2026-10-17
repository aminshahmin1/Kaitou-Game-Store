"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { FundingCostBasis } from "@/lib/funding-cost";
import { estimateCostMyr } from "@/lib/cost-conversion";

type Balance = { balanceUsd: number; currency: string; checkedAt: string };
export function AdminBalanceLive({ initialBalance, initialBasis }: {
  initialBalance: Balance | null;
  initialBasis: FundingCostBasis | null;
}) {
  const [balance, setBalance] = useState(initialBalance);
  const [basis, setBasis] = useState(initialBasis);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(initialBalance ? null : "Balance unavailable.");
  const pending = useRef<AbortController | null>(null);
  const lastAttempt = useRef(0);

  const sync = useCallback(async () => {
    if (pending.current || Date.now() - lastAttempt.current < 5000) return;
    lastAttempt.current = Date.now();
    const controller = new AbortController();
    pending.current = controller;
    setSyncing(true);
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("/api/admin/fazercards/balance", { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("Sync failed");
      const data = await response.json();
      if (!data.balance || !Number.isFinite(data.balance.balanceUsd) || data.balance.balanceUsd < 0
        || !Number.isFinite(Date.parse(data.balance.checkedAt))) throw new Error("Invalid balance");
      if (pending.current !== controller) return;
      setBalance(data.balance);
      setBasis(data.basis ?? null);
      setError(null);
    } catch {
      if (pending.current === controller) setError("Sync failed. Any balance shown is the last successful reading.");
    } finally {
      window.clearTimeout(timeout);
      if (pending.current === controller) { pending.current = null; setSyncing(false); }
    }
  }, []);

  useEffect(() => {
    const refreshVisible = () => { if (document.visibilityState === "visible") void sync(); };
    refreshVisible();
    const interval = window.setInterval(refreshVisible, 60000);
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
      const controller = pending.current;
      pending.current = null;
      lastAttempt.current = 0;
      controller?.abort();
    };
  }, [sync]);

  return <section className="border-b border-slate-200 py-5" aria-busy={syncing}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-sm font-semibold text-slate-600">FazerCards live balance</h2>
      <button type="button" onClick={() => void sync()} disabled={syncing}
        className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-60">
        <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />{syncing ? "Syncing..." : "Sync balance"}
      </button>
    </div>
    <p className="mt-2 text-2xl font-bold">{balance ? `USD ${balance.balanceUsd.toFixed(4)}` : "Unavailable"}</p>
    <p className="mt-1 text-sm text-slate-600">{balance && basis
      ? `Estimated value RM ${estimateCostMyr(balance.balanceUsd, basis.rate).toFixed(2)} at RM ${basis.rate.toFixed(4)} / USD. ${basis.label}.`
      : "MYR funding cost unavailable."}</p>
    <p className="mt-1 text-sm text-slate-500">{balance
      ? `Checked ${new Intl.DateTimeFormat("en-MY", { timeZone: "Asia/Kuala_Lumpur", dateStyle: "medium", timeStyle: "medium" }).format(new Date(balance.checkedAt))} MYT`
      : "No successful balance reading."}</p>
    {error && <p role="status" className="mt-2 text-sm font-semibold text-red-700">{error}</p>}
  </section>;
}
