import type { Product } from "./types";

export function applyBalanceAvailability(products: Product[], balanceUsd: number | null): Product[] {
  const balanceUnits = balanceUsd === null ? -1 : Math.floor(balanceUsd * 10_000 + 1e-7);
  return products.map((product) => {
    const variations = product.variations.map((variation) => ({
      ...variation,
      available: variation.available && variation.active && variation.priceMyr >= 1 &&
        Number.isFinite(variation.costUsd) && variation.costUsd > 0 &&
        Math.ceil(variation.costUsd * 10_000 - 1e-7) <= balanceUnits &&
        Boolean(variation.fazercardsSku),
    }));
    return { ...product, variations, available: product.available && variations.some((v) => v.available) };
  });
}
