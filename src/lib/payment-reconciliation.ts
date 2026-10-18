import "server-only";
import { createSupabaseAdminClient } from "./supabase/admin";
import { getToyyibPayTransactions } from "./integrations/toyyibpay";
import { markOrderPaymentCallback } from "./orders";

export async function reconcileNextPayment() {
  const db = createSupabaseAdminClient();
  if (!db) throw new Error("Database is not configured.");
  const { data: order, error } = await db.from("orders")
    .select("id,order_number,payment_reference,updated_at")
    .eq("status", "pending_payment").is("paid_at", null).not("payment_reference", "is", null)
    .gte("created_at", new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString())
    .order("updated_at", { ascending: true }).limit(1).maybeSingle();
  if (error) throw new Error("Pending payments could not be loaded.");
  if (!order) return { paid: 0, checked: 0 };
  try {
    const transactions = await getToyyibPayTransactions(order.payment_reference);
    const paid = transactions.find((t) => String(t.billpaymentStatus) === "1"
      && String(t.billExternalReferenceNo) === order.order_number
      && Number.isFinite(Number(t.billpaymentAmount)) && Number(t.billpaymentAmount) > 0);
    if (paid) {
      const result = await markOrderPaymentCallback({ orderId: order.order_number,
        billCode: order.payment_reference, paymentStatus: "success", amountMyr: Number(paid.billpaymentAmount),
        rawPayload: { source: "verified_transaction_poll", amount: String(paid.billpaymentAmount) },
      });
      return { paid: result.processed || result.reason === "amount_mismatch" ? 1 : 0, checked: 1 };
    }
  } finally {
    // Rotate unpaid or failed lookups without overwriting a concurrently paid order.
    const { error: savedError } = await db.from("orders").update({ updated_at: new Date().toISOString() })
      .eq("id", order.id).eq("status", "pending_payment").is("paid_at", null)
      .eq("payment_reference", order.payment_reference).eq("updated_at", order.updated_at);
    if (savedError) throw new Error("Payment retry could not be recorded.");
  }
  return { paid: 0, checked: 1 };
}
