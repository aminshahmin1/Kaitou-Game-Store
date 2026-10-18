import "server-only";
import { z } from "zod";
import { createSupabaseAdminClient } from "./supabase/admin";
import { getEmailConfiguration, sendStoreEmail } from "./integrations/email";

const payloadSchema = z.object({
  orderNumber: z.string().min(1), status: z.enum(["processing", "completed", "failed", "review", "refunded"]),
  product: z.string(), variation: z.string(), name: z.string(), email: z.email(), whatsapp: z.string(),
  fields: z.record(z.string(), z.string()), amountMyr: z.coerce.number().finite().positive(),
  subtotalMyr: z.coerce.number().nullable(), feeMyr: z.coerce.number(), paidAt: z.string(),
  refundReference: z.string().nullable(),
});
const statusText = {
  processing: "Processing", completed: "Completed", failed: "Failed", review: "Review", refunded: "Refunded",
};

export function formatOrderEmail(raw: unknown, audience: "customer" | "admin") {
  const p = payloadSchema.parse(raw);
  const lines = [
    `Hi ${p.name},`, "", `Order ${p.orderNumber}: ${statusText[p.status]}`,
    `${p.product}${p.variation ? ` - ${p.variation}` : ""}`,
    ...(p.subtotalMyr !== null ? [`Items: RM${p.subtotalMyr.toFixed(2)}`, `FPX fee: RM${p.feeMyr.toFixed(2)}`] : []),
    `Order total: RM${p.amountMyr.toFixed(2)}`, "",
    p.status === "processing" ? "Your payment is confirmed. Your order is being processed."
      : p.status === "completed" ? "Your order has been delivered. Thank you for shopping with Kaitou Game Store."
      : p.status === "refunded" ? `Your refund has been recorded. Reference: ${p.refundReference ?? p.orderNumber}.`
      : "Your order needs support attention. Please contact Kaitou with your order number.",
    "", `Check your order: https://kaitou.shop/order-status?order_id=${encodeURIComponent(p.orderNumber)}`,
    "Support: amin@kaitou.shop", "Kaitou Game Store",
  ];
  if (audience === "admin") lines.push("", "Customer details", `Email: ${p.email}`, `WhatsApp: ${p.whatsapp}`,
    ...Object.entries(p.fields).map(([key, value]) => `${key}: ${value}`), "Dashboard: https://kaitou.shop/dashboard/review");
  return { to: p.email, subject: `Kaitou ${p.orderNumber}: ${statusText[p.status]}`, text: lines.join("\n") };
}

export async function deliverNextOrderEmail() {
  const db = createSupabaseAdminClient();
  if (!db) throw new Error("Database is not configured.");
  const { data, error } = await db.rpc("claim_order_email");
  if (error) throw new Error("Email queue could not be loaded.");
  const job = data?.[0];
  if (!job) return { sent: 0, failed: 0 };
  try {
    if (!["customer", "admin"].includes(job.audience)) throw new Error("Invalid audience.");
    const message = formatOrderEmail(job.payload, job.audience);
    const to = job.audience === "admin" ? getEmailConfiguration().recipient : message.to;
    if (!to) throw new Error("Recipient is not configured.");
    await sendStoreEmail(to, message.subject, message.text, `<order-${job.id}@kaitou.shop>`);
    const { error: savedError } = await db.from("order_email_outbox")
      .update({ state: "sent", sent_at: new Date().toISOString(), lease_until: null, last_error: null })
      .eq("id", job.id).eq("lease_token", job.lease_token).eq("state", "sending");
    if (savedError) throw new Error("Email acknowledgement failed.");
    return { sent: 1, failed: 0 };
  } catch {
    const { error: savedError } = await db.from("order_email_outbox").update({
      state: job.attempts >= 5 ? "failed" : "pending", lease_until: null,
      next_attempt_at: new Date(Date.now() + Math.min(60, 2 ** job.attempts) * 60_000).toISOString(),
      last_error: "Email delivery could not be confirmed. Check SMTP before retrying.",
    }).eq("id", job.id).eq("lease_token", job.lease_token).eq("state", "sending");
    if (savedError) throw new Error("Email retry could not be recorded.");
    return { sent: 0, failed: 1 };
  }
}
