import type { Product, ProductVariation } from "./types";

export type CheckoutProduct = Pick<Product, "slug" | "title" | "requiredFields"> & {
  variations: Pick<ProductVariation, "id" | "title" | "priceMyr" | "active" | "available">[];
};

export function toCheckoutProduct(product: Product): CheckoutProduct {
  return {
    slug: product.slug,
    title: product.title,
    requiredFields: product.requiredFields.map(({ key, label, placeholder, help, type, options }) => ({
      key, label, placeholder, help, type, ...(options ? { options: [...options] } : {}),
    })),
    variations: product.variations.map(({ id, title, priceMyr, active, available }) => ({
      id, title, priceMyr, active, available,
    })),
  };
}
