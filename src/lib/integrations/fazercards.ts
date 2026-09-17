import "server-only";

import type { Product } from "../types";
import type { ProductVariation } from "../types";

type FazerCardsOrderInput = {
  orderId: string;
  product: Product;
  variation: ProductVariation;
  fieldValues: Record<string, string>;
};

type FazerCardsOrderResult = {
  setupRequired: boolean;
  providerReference: string;
  status: "processing" | "review" | "failed";
  message: string;
  raw?: unknown;
};

function getConfig() {
  const apiBaseUrl = process.env.FAZERCARDS_API_BASE_URL ?? "https://api.fzr.cards/api/v2";
  const apiKey = process.env.FAZERCARDS_API_KEY;

  return { apiBaseUrl: apiBaseUrl.replace(/\/$/, ""), apiKey };
}

export async function createFazerCardsOrder(input: FazerCardsOrderInput) {
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

  const body = await fazerCardsFetch<{
    ok?: boolean;
    order_id?: string;
    status?: string;
    error?: string;
  }>(input, "/topups/order", {
    category_id: categoryId,
    offer_id: offerId,
    fields: input.fieldValues,
  });

  return {
    setupRequired: false,
    providerReference: body.order_id ?? `fazercards-${input.orderId}`,
    status: "processing",
    message: "FazerCards top-up order created.",
    raw: body,
  };
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

  const body = await fazerCardsFetch<{
    ok?: boolean;
    order_id?: string;
    status?: string;
    error?: string;
  }>(input, "/steam-gifts/order", {
    invite_url: inviteUrl,
    sub_id: Number(subIdRaw),
    app_id: Number(appIdRaw),
    region: regionRaw,
  });

  return {
    setupRequired: false,
    providerReference: body.order_id ?? `fazercards-${input.orderId}`,
    status: "processing",
    message: "FazerCards Steam gift order created.",
    raw: body,
  };
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
  });

  const body = (await response.json().catch(() => null)) as (T & { ok?: boolean; error?: string }) | null;

  if (!response.ok || !body || body.ok === false) {
    throw new Error(body?.error ?? `FazerCards request failed with HTTP ${response.status}`);
  }

  return body;
}
