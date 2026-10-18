import "server-only";
import { cache } from "react";
import { z } from "zod";

const balanceSchema = z.object({
  ok: z.literal(true),
  currency: z.literal("USD"),
  balance: z.string().regex(/^\d+(\.\d{1,4})?$/),
});

export const getFazerCardsBalance = cache(async () => {
  const key = process.env.FAZERCARDS_API_KEY;
  if (!key) throw new Error("FazerCards is not configured.");
  const base = (process.env.FAZERCARDS_API_BASE_URL ?? "https://api.fzr.cards/api/v2").replace(/\/$/, "");
  const observedAt = new Date().toISOString();
  const response = await fetch(`${base}/balance`, {
    headers: { "X-API-Key": key, Accept: "application/json" },
    cache: "no-store", signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("FazerCards balance is unavailable.");
  const data = balanceSchema.parse(await response.json());
  const units = Math.round(Number(data.balance) * 10_000);
  if (!Number.isSafeInteger(units)) throw new Error("Invalid provider balance.");
  return { balanceUsd: units / 10_000, currency: data.currency, observedAt, checkedAt: new Date().toISOString() };
});
