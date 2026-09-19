import "server-only";
import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "./supabase/admin";
import { createToyyibPayPayment, getToyyibPayTransactions } from "./integrations/toyyibpay";

function database() {
  const client = createSupabaseAdminClient();
  if (!client) throw new Error("Payment test storage is unavailable.");
  return client;
}

export async function createToyyibPayTest(input: { customerName: string; customerEmail: string; whatsapp: string }) {
  const client = database();
  const id = `KTEST-${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const { error } = await client.from("toyyibpay_tests").insert({ id });
  if (error) throw new Error("Payment test could not be recorded.");
  const bill = await createToyyibPayPayment({ ...input, orderId: id, amountMyr: 1, description: "Kaitou RM1 FPX integration test", test: true });
  const { error: saveError } = await client.from("toyyibpay_tests").update({ bill_code: bill.providerReference }).eq("id", id);
  if (saveError) throw new Error("Payment reference could not be saved. Do not pay this test bill.");
  return { id, paymentUrl: bill.paymentUrl };
}

export async function getToyyibPayTests() {
  const { data, error } = await database().from("toyyibpay_tests").select("id,bill_code,status,amount_myr,callback_received_at,created_at").order("created_at", { ascending: false }).limit(10);
  if (error) throw new Error("Payment tests could not be loaded.");
  return data;
}

export async function checkToyyibPayTest(id: string) {
  const { data, error } = await database().from("toyyibpay_tests").select("id,bill_code,status,amount_myr,callback_received_at").eq("id", id).maybeSingle();
  if (error || !data?.bill_code) throw new Error("Payment test was not found.");
  const transactions = await getToyyibPayTransactions(data.bill_code);
  return { ...data, providerConfirmed: transactions.some((row) => String(row.billExternalReferenceNo) === id && String(row.billpaymentStatus) === "1" && Number(row.billpaymentAmount) === 1) };
}

export async function recordToyyibPayTestCallback(input: { orderId: string; billCode: string; paymentStatus: "success" | "pending" | "failed"; amountMyr: number | null }) {
  const client = database();
  const { data, error } = await client.from("toyyibpay_tests").select("id,bill_code,status").eq("id", input.orderId).maybeSingle();
  if (error) throw new Error("Payment test lookup failed.");
  if (!data || !data.bill_code || data.bill_code !== input.billCode) return { processed: false, reason: "bill_code_mismatch" };
  if (input.paymentStatus === "success" && input.amountMyr !== 1) return { processed: false, reason: "invalid_test_amount" };
  const { error: saveError } = await client.from("toyyibpay_tests").update({ status: input.paymentStatus, callback_received_at: new Date().toISOString() }).eq("id", data.id).neq("status", "success");
  if (saveError) throw new Error("Payment test callback could not be saved.");
  return { processed: true, reason: "test_recorded" };
}
