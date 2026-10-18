import "server-only";
import { createSupabaseAdminClient } from "./supabase/admin";
import { getFazerCardsBalance } from "./integrations/fazercards-balance";

export async function getAvailableSupplierCredit() {
  const db = createSupabaseAdminClient();
  if (!db) throw new Error("Database is not configured.");
  const balance = await getFazerCardsBalance();
  const { data, error } = await db.rpc("available_supplier_credit", {
    p_balance: balance.balanceUsd, p_observed_at: balance.observedAt,
  });
  if (error || !Number.isFinite(Number(data))) throw new Error("Available supplier credit could not be checked.");
  return Number(data);
}

export async function reserveSupplierCredit(orderNumber: string) {
  const db = createSupabaseAdminClient();
  if (!db) throw new Error("Database is not configured.");
  const balance = await getFazerCardsBalance();
  const { data, error } = await db.rpc("reserve_supplier_credit", {
    p_order_number: orderNumber, p_balance: balance.balanceUsd, p_observed_at: balance.observedAt,
  });
  if (error) throw new Error("Supplier credit reservation could not be checked.");
  return data === true;
}

export async function hasSupplierReservation(orderId: string) {
  const db = createSupabaseAdminClient();
  if (!db) throw new Error("Database is not configured.");
  const { data, error } = await db.from("supplier_reservations").select("state")
    .eq("order_id", orderId).in("state", ["held", "debited"]).maybeSingle();
  if (error) throw new Error("Supplier reservation could not be loaded.");
  return Boolean(data);
}
