import { z } from "zod";
import type { Product, ProductVariation } from "./types";

const snapshotSchema = z.object({
  version: z.literal(1),
  product: z.object({
    type: z.enum(["topup", "steam_gift_game"]),
    fazercardsProductId: z.string().min(1).nullable(),
  }),
  variation: z.object({
    sku: z.string().min(1),
    fazercardsSku: z.string().min(1),
  }),
});

export function createFulfillmentSnapshot(product: Product, variation: ProductVariation) {
  return snapshotSchema.parse({
    version: 1,
    product: { type: product.type, fazercardsProductId: product.fazercardsProductId || null },
    variation: { sku: variation.sku, fazercardsSku: variation.fazercardsSku },
  });
}

export function readFulfillmentSnapshot(value: unknown) {
  const result = snapshotSchema.safeParse(value);
  if (!result.success) {
    throw new Error("Order has no verified supplier mapping snapshot. Confirm the original item before fulfillment.");
  }
  return result.data;
}
