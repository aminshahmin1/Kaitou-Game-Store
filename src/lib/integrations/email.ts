import "server-only";

import nodemailer from "nodemailer";
import { z } from "zod";

export function getEmailConfiguration() {
  const from = process.env.EMAIL_FROM?.trim();
  const recipient = process.env.ADMIN_ORDER_EMAIL?.trim();
  return {
    configured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD &&
      z.email().safeParse(from).success && z.email().safeParse(recipient).success),
    from: from ?? null,
    recipient: recipient ?? null,
  };
}

export async function sendAdminEmail(subject: string, text: string) {
  const config = getEmailConfiguration();
  if (!config.recipient) throw new Error("Admin email is not configured.");
  return sendStoreEmail(config.recipient, subject, text);
}

export function escapeEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export function brandedEmailHtml(title: string, content: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#f2f5f7;color:#19232b;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #dce4e8"><tr><td style="padding:24px;background:#07131c;border-bottom:4px solid #00bce8;color:#ffffff"><strong style="font-size:24px">KAITOU</strong><br><span style="font-size:13px;color:#c2d1db">GAME STORE</span></td></tr><tr><td style="padding:24px;overflow-wrap:anywhere"><h1 style="font-size:22px;line-height:1.4;margin:0 0 20px">${escapeEmailHtml(title)}</h1>${content}</td></tr><tr><td style="padding:20px 24px;background:#f6f8fa;font-size:12px;line-height:1.7;color:#52616c">Kaitou Game Store &middot; <a href="https://kaitou.shop" style="color:#006b86">kaitou.shop</a><br>Need help? <a href="mailto:amin@kaitou.shop" style="color:#006b86">amin@kaitou.shop</a><br>We will never ask for your banking password, OTP or game password by email.</td></tr></table></td></tr></table></body></html>`;
}

export type StoreEmailOptions = { replyTo?: string; attachments?: { filename: string; content: Buffer; contentType: string }[] };

export async function sendStoreEmail(to: string, subject: string, text: string, messageId?: string, html?: string, options: StoreEmailOptions = {}) {
  const config = getEmailConfiguration();
  if (!config.configured || !config.from || !config.recipient) {
    throw new Error("Email configuration is incomplete.");
  }
  if (!z.email().safeParse(to).success) throw new Error("Recipient email is invalid.");
  if (options.replyTo && !z.email().safeParse(options.replyTo).success) throw new Error("Reply email is invalid.");
  const port = Number(process.env.SMTP_PORT ?? "465");
  if (![465, 587].includes(port)) throw new Error("SMTP must use a TLS-enabled port.");
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD?.replace(/\s/g, "") },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  try {
    const result = await transport.sendMail({
      from: { name: "Kaitou Game Store", address: config.from },
      to,
      ...(messageId ? { messageId } : {}),
      subject: subject.replace(/[\r\n]/g, " ").slice(0, 200),
      text,
      html: html ?? brandedEmailHtml(subject, `<p style="white-space:pre-line;line-height:1.7">${escapeEmailHtml(text)}</p>`),
      replyTo: options.replyTo ?? config.from,
      ...(options.attachments?.length ? { attachments: options.attachments } : {}),
    });
    if (!result.accepted.length || result.rejected.length) throw new Error("Email was not accepted.");
    return { sent: true, messageId: result.messageId };
  } finally {
    transport.close();
  }
}
