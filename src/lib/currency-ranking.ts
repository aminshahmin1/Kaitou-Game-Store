import "server-only";
import { createHash } from "node:crypto";
import { isRankingCurrency } from "./custom-packages";
import { createSupabaseAdminClient } from "./supabase/admin";
import type { Product, ProductVariation } from "./types";

export function makeRankingSnapshot(product: Product, variation: ProductVariation, fields: Record<string, string>) {
  const unit = product.leaderboardUnit?.trim();
  const units = variation.currencyUnits ?? 0;
  const empty = { ranking_game: null, ranking_unit: null, ranking_player_key: null, ranking_player_mask: null, ranking_units: 0 };
  if (product.type !== "topup" || !unit || !Number.isSafeInteger(units) || units <= 0 || units > 5_000_000_000
    || !isRankingCurrency(variation.basePackageTitle ?? variation.title)) return empty;
  const entries = Object.entries(fields).map(([key, value]) => [key.toLowerCase().replace(/[^a-z]/g, ""), value.trim()]);
  const player = entries.find(([key]) => ["playerid", "userid", "uid", "accountid", "roleid"].includes(key))?.[1];
  if (!player || !/^[0-9]{4,32}$/.test(player)) return empty;
  const server = entries.find(([key]) => ["serverid", "zoneid", "server", "zone"].includes(key))?.[1] ?? "";
  const game = `${product.game.trim()} (${product.region})`;
  return { ranking_game: game, ranking_unit: unit,
    ranking_player_key: createHash("sha256").update(JSON.stringify([game.toLowerCase(), server, player])).digest("hex"),
    ranking_player_mask: `****${player.slice(player.length < 6 ? -2 : -4)}`, ranking_units: units };
}

export type RankingRow = { game: string; unit: string; player: string; units: number };
export async function getCurrencyRankings(): Promise<RankingRow[]> {
  const db = createSupabaseAdminClient();
  if (!db) throw new Error("Rankings are unavailable.");
  const { data, error } = await db.rpc("currency_leaderboard");
  if (error) throw new Error("Rankings are unavailable.");
  return (data ?? []).map((row: { game: string; unit: string; masked_player_id: string; total_units: string | number }) => {
    const units = Number(row.total_units);
    if (!Number.isSafeInteger(units) || units < 1) throw new Error("Ranking total is invalid.");
    return { game: row.game, unit: row.unit, player: row.masked_player_id, units };
  });
}
