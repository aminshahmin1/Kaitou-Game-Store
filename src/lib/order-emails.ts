import "server-only";
import { z } from "zod";
import { createSupabaseAdminClient } from "./supabase/admin";
import { brandedEmailHtml, escapeEmailHtml, getEmailConfiguration, sendStoreEmail } from "./integrations/email";

const payloadSchema = z.object({
  orderNumber: z.string().min(1), status: z.enum(["processing", "completed", "failed", "review", "refunded"]),
  product: z.string(), variation: z.string(), name: z.string(), email: z.email(), whatsapp: z.string(),
  fields: z.record(z.string(), z.string()), amountMyr: z.coerce.number().finite().positive(),
  subtotalMyr: z.coerce.number().nullable(), feeMyr: z.coerce.number(), paidAt: z.string(),
  refundReference: z.string().nullable(),
  paymentReference: z.string().nullable().optional(),
});
const statusText = {
  processing: "Processing", completed: "Completed", failed: "Failed", review: "Review", refunded: "Refunded",
};

export function formatOrderEmail(raw: unknown, audience: "customer" | "admin") {
  const p = payloadSchema.parse(raw);
  const paidDate = new Date(p.paidAt);
  if (!Number.isFinite(paidDate.getTime())) throw new Error("Receipt payment date is invalid.");
  const paidAt = new Intl.DateTimeFormat("en-MY", {
    dateStyle: "long", timeStyle: "short", timeZone: "Asia/Kuala_Lumpur",
  }).format(paidDate) + " MYT";
  const title = audience === "admin" ? `Order ${statusText[p.status].toLowerCase()}` : "Your payment receipt";
  const update = p.status === "processing" ? "Thank you. Your payment is confirmed and your order is being processed."
    : p.status === "completed" ? "Your order is complete. Thank you for choosing Kaitou Game Store."
    : p.status === "refunded" ? "A refund has been recorded for this order. Your original payment receipt is included below; this is not a new charge."
    : p.status === "review" ? "Our support team needs to review your paid order. Please do not pay again. Contact us with your order number for assistance."
    : "Your order could not be completed. Please do not pay again. Contact us with your order number so we can assist you.";
  const statusUrl = `https://kaitou.shop/order-status?order_id=${encodeURIComponent(p.orderNumber)}`;
  const details = [
    ["Receipt / order number", p.orderNumber], ["Payment received", paidAt],
    ["Payment method", "FPX online banking"], ["Payment status", "Paid"],
    ...(p.paymentReference ? [["Payment reference", p.paymentReference]] : []),
    ["Order status", statusText[p.status]], ["Customer", p.name], ["Email", p.email],
    ["WhatsApp", p.whatsapp], ["Product", p.product], ["Package", p.variation || "Standard"], ["Quantity", "1"],
    ...Object.entries(p.fields).map(([key, value]) => [key.replace(/_/g, " "), value]),
    ...(p.subtotalMyr !== null ? [["Items", `RM${p.subtotalMyr.toFixed(2)}`], ["FPX fee", `RM${p.feeMyr.toFixed(2)}`]] : []),
    ["Order total", `RM${p.amountMyr.toFixed(2)}`],
    ...(p.status === "refunded" && p.refundReference ? [["Refund reference", p.refundReference]] : []),
  ];
  const lines = [
    "KAITOU GAME STORE", title, "", audience === "admin" ? "Paid order update" : `Hi ${p.name},`, "", update, "",
    ...details.map(([label, value]) => `${label}: ${value}`), "", "All amounts are in Malaysian ringgit (MYR).",
    "Keep this receipt for your records. Status updates refer to the same payment, not additional charges.",
    `Check your order: ${statusUrl}`, "Support: amin@kaitou.shop", "Kaitou Game Store | https://kaitou.shop",
  ];
  const actionUrl = audience === "admin" ? "https://kaitou.shop/dashboard/orders" : statusUrl;
  const html = brandedEmailHtml(title, `<p style="line-height:1.7">${audience === "admin" ? "Paid order update" : `Hi ${escapeEmailHtml(p.name)},`}</p><p style="line-height:1.7">${escapeEmailHtml(update)}</p><table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px">${details.map(([label, value]) => `<tr><th scope="row" align="left" style="width:40%;padding:12px 8px;border-bottom:1px solid #e2e8ec;color:#52616c;font-weight:normal;vertical-align:top">${escapeEmailHtml(label)}</th><td style="padding:12px 8px;border-bottom:1px solid #e2e8ec;overflow-wrap:anywhere;word-break:break-word;${label === "Order total" ? "font-size:20px;font-weight:bold" : ""}">${escapeEmailHtml(value)}</td></tr>`).join("")}</table><p style="font-size:12px;line-height:1.7;color:#52616c">All amounts are in Malaysian ringgit (MYR). Keep this receipt for your records. Status updates refer to the same payment, not additional charges.</p><p style="margin:24px 0"><a href="${escapeEmailHtml(actionUrl)}" style="display:inline-block;background:#006b86;color:#ffffff;text-decoration:none;padding:14px 20px;border-radius:4px">${audience === "admin" ? "View order in dashboard" : "View order status"}</a></p>`);
  if (audience === "admin") lines.push("Dashboard: https://kaitou.shop/dashboard/orders");
  return { to: p.email, subject: `Kaitou | ${p.orderNumber} | ${statusText[p.status]}${audience === "customer" ? " - Receipt" : ""}`, text: lines.join("\n"), html };
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
    await sendStoreEmail(to, message.subject, message.text, `<order-${job.id}@kaitou.shop>`, message.html);
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
