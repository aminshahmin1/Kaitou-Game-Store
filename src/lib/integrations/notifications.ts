import "server-only";

import type { OrderStatus, Product } from "../types";

type NotificationInput = {
  orderId: string;
  product: Product;
  status: OrderStatus;
  whatsapp: string;
  amountMyr: number;
};

const silentStatuses = new Set<OrderStatus>(["processing"]);

export async function notifyCustomer(input: NotificationInput) {
  const provider = process.env.WHATSAPP_PROVIDER ?? "manual";

  if (silentStatuses.has(input.status) || provider === "manual") {
    return {
      sent: false,
      mode: provider,
      message: "Customer WhatsApp notification is disabled or waiting for final status.",
    };
  }

  return {
    sent: false,
    mode: provider,
    message: "WhatsApp provider adapter is ready for credentials.",
  };
}

export async function notifyAdmin(input: NotificationInput) {
  const adminEmail = process.env.ADMIN_ORDER_EMAIL;

  if (!adminEmail) {
    return {
      sent: false,
      message: "Admin order email is not configured.",
    };
  }

  return {
    sent: false,
    message: `Email provider adapter is ready to send order ${input.orderId} to ${adminEmail}.`,
  };
}
