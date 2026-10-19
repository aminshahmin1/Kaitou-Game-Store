import type { Product, ProductVariation } from "./types";

export type CheckoutProduct = Pick<Product, "slug" | "title" | "requiredFields"> & {
  steamGift?: boolean;
  variations: Pick<ProductVariation, "id" | "title" | "priceMyr" | "active" | "available" | "edition" | "region">[];
};

export function toCheckoutProduct(product: Product): CheckoutProduct {
  return {
    slug: product.slug,
    title: product.title,
    ...(product.type === "steam_gift_game" ? { steamGift: true } : {}),
    requiredFields: product.requiredFields.map(({ key, label, placeholder, help, type, options }) => ({
      key, label, placeholder, help, type, ...(options ? { options: [...options] } : {}),
    })),
    variations: product.variations.map(({ id, title, priceMyr, active, available, edition, region }) => ({
      id, title, priceMyr, active, available,
      ...(product.type === "steam_gift_game" ? { edition: edition ?? title, region: region ?? "" } : {}),
    })),
  };
}
