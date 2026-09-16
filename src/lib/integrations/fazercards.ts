import "server-only";

import type { Product } from "../types";
import type { ProductVariation } from "../types";

type FazerCardsOrderInput = {
  orderId: string;
  product: Product;
  variation: ProductVariation;
  fieldValues: Record<string, string>;
};

export async function createFazerCardsOrder(input: FazerCardsOrderInput) {
  const apiBaseUrl = process.env.FAZERCARDS_API_BASE_URL ?? "https://api.fzr.cards/api/v2";
  const apiKey = process.env.FAZERCARDS_API_KEY;

  if (!apiKey) {
    return {
      setupRequired: true,
      providerReference: `pending-fazer-${input.orderId}`,
      status: "review" as const,
      message: "FazerCards API key is not active. Order is ready for admin review.",
    };
  }

  // Map each manual product SKU to FazerCards' current order endpoint here.
  return {
    setupRequired: false,
    providerReference: `${apiBaseUrl}:${input.variation.fazercardsSku ?? input.variation.sku}:${input.orderId}`,
    status: "processing" as const,
    message: "FazerCards order is ready for server-side fulfillment.",
  };
}
