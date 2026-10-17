import "server-only";

import type { Product } from "../types";
import type { ProductVariation } from "../types";

type FazerCardsOrderInput = {
  orderId: string;
  product: Pick<Product, "type" | "fazercardsProductId">;
  variation: Pick<ProductVariation, "sku" | "fazercardsSku">;
  fieldValues: Record<string, string>;
};

type FazerCardsOrderResult = {
  setupRequired: boolean;
  providerReference: string;
  status: "processing" | "completed" | "review" | "failed";
  message: string;
  raw?: unknown;
  chargedUsd?: number;
};

function getConfig() {
  const apiBaseUrl = process.env.FAZERCARDS_API_BASE_URL ?? "https://api.fzr.cards/api/v2";
  const apiKey = process.env.FAZERCARDS_API_KEY;

  return { apiBaseUrl: apiBaseUrl.replace(/\/$/, ""), apiKey };
}

export async function createFazerCardsOrder(input: FazerCardsOrderInput): Promise<FazerCardsOrderResult> {
  const { apiBaseUrl, apiKey } = getConfig();

  if (!apiKey) {
    return {
      setupRequired: true,
      providerReference: `pending-fazer-${input.orderId}`,
      status: "review" as const,
      message: "FazerCards API key is not active. Order is ready for admin review.",
    };
  }

  if (input.product.type === "topup") {
    return createTopupOrder({ ...input, apiBaseUrl, apiKey });
  }

  if (input.product.type === "steam_gift_game") {
    return createSteamGiftOrder({ ...input, apiBaseUrl, apiKey });
  }

  return {
    setupRequired: false,
    providerReference: `unsupported-${input.orderId}`,
    status: "review" as const,
    message: "This product type needs manual review before FazerCards fulfillment.",
  };
}

async function createTopupOrder(
  input: FazerCardsOrderInput & { apiBaseUrl: string; apiKey: string },
): Promise<FazerCardsOrderResult> {
  const mappedSku = input.variation.fazercardsSku || input.variation.sku;
  const [categoryIdFromSku, offerId] = mappedSku.split(":");
  const categoryId = input.product.fazercardsProductId || categoryIdFromSku;

  if (!categoryId || !offerId) {
    return {
      setupRequired: false,
      providerReference: `unmapped-${input.orderId}`,
      status: "review",
      message: "Missing FazerCards top-up mapping. Use category_id:offer_id on the variation.",
    };
  }

  const body = await fazerCardsFetch<FazerCardsOrderEnvelope>(input, "/topups/order", {
    category_id: categoryId,
    offer_id: offerId,
    fields: input.fieldValues,
  });

  return parseFazerCardsOrder(body);
}

async function createSteamGiftOrder(
  input: FazerCardsOrderInput & { apiBaseUrl: string; apiKey: string },
): Promise<FazerCardsOrderResult> {
  const mappedSku = input.variation.fazercardsSku || input.variation.sku;
  const [appIdRaw, subIdRaw, regionRaw] = mappedSku.split(":");
  const inviteUrl =
    input.fieldValues.invite_url ?? input.fieldValues.steam_invite_url ?? input.fieldValues.steamInviteUrl;

  if (!appIdRaw || !subIdRaw || !regionRaw || !inviteUrl) {
    return {
      setupRequired: false,
      providerReference: `unmapped-${input.orderId}`,
      status: "review",
      message:
        "Missing FazerCards Steam gift mapping. Use app_id:sub_id:region on the variation and collect a Steam invite URL.",
    };
  }

  const body = await fazerCardsFetch<FazerCardsOrderEnvelope>(input, "/steam-gifts/order", {
    invite_url: inviteUrl,
    sub_id: Number(subIdRaw),
    app_id: Number(appIdRaw),
    region: regionRaw,
  });

  return parseFazerCardsOrder(body);
}

type FazerCardsOrderEnvelope = {
  ok: boolean;
  order?: { id?: string; status?: string; fail_reason?: string | null; total_usd?: string };
};

export function parseFazerCardsOrder(body: FazerCardsOrderEnvelope): FazerCardsOrderResult {
  const order = body.order;
  if (!body.ok || !order?.id || !order.status) {
    throw new Error("Supplier response is incomplete. Check supplier order history before retrying.");
  }
  const status = order.status === "completed" ? "completed"
    : ["created", "processing"].includes(order.status) ? "processing" : "review";
  const chargedUsd = typeof order.total_usd === "string" && /^\d+(\.\d{1,4})?$/.test(order.total_usd)
    && Number.isSafeInteger(Math.round(Number(order.total_usd) * 10_000)) && Number(order.total_usd) > 0
    ? Number(order.total_usd) : undefined;
  return {
    setupRequired: false,
    providerReference: order.id,
    status,
    message: status === "review" ? order.fail_reason || `Supplier status: ${order.status}` : `Supplier order ${order.status}.`,
    raw: body,
    chargedUsd,
  };
}

export async function getFazerCardsOrder(reference: string) {
  const { apiBaseUrl, apiKey } = getConfig();
  if (!apiKey) throw new Error("FazerCards is not configured.");
  const response = await fetch(`${apiBaseUrl}/orders/${encodeURIComponent(reference)}`, {
    headers: { "X-API-Key": apiKey, Accept: "application/json" },
    cache: "no-store", signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Supplier order lookup failed.");
  const result = parseFazerCardsOrder(await response.json());
  if (result.providerReference !== reference) throw new Error("Supplier order reference mismatch.");
  return result;
}

async function fazerCardsFetch<T>(
  input: FazerCardsOrderInput & { apiBaseUrl: string; apiKey: string },
  path: string,
  payload: Record<string, unknown>,
) {
  const response = await fetch(`${input.apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Idempotency-Key": input.orderId,
      "X-API-Key": input.apiKey,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  const body = (await response.json().catch(() => null)) as (T & { ok?: boolean; error?: string }) | null;

  if (!response.ok || !body || body.ok === false) {
    throw new Error(body?.error ?? `FazerCards request failed with HTTP ${response.status}`);
  }

  return body;
}
