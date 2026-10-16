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
  if (!config.configured || !config.from || !config.recipient) {
    throw new Error("Email configuration is incomplete.");
  }
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
      to: config.recipient,
      subject: subject.replace(/[\r\n]/g, " ").slice(0, 200),
      text,
    });
    if (!result.accepted.length || result.rejected.length) throw new Error("Email was not accepted.");
    return { sent: true, messageId: result.messageId };
  } finally {
    transport.close();
  }
}
