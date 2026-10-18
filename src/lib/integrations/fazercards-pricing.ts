import "server-only";
import type { Product } from "../types";
import { getFazerCardsCatalogDetails } from "./fazercards-catalog";
import { isRepeatableCurrency } from "../custom-packages";

export async function refreshSupplierPrices(products: Product[]) {
  const refreshed: Product[] = [];
  for (const product of products) {
    try {
      if (!product.fazercardsProductId) throw new Error("Missing supplier mapping.");
      const details = await getFazerCardsCatalogDetails(
        product.type === "steam_gift_game" ? "steam_gift" : "topup",
        product.fazercardsProductId,
        product.title,
      );
      if (details.categoryId !== product.fazercardsProductId) throw new Error("Supplier category mismatch.");
      const offers = new Map(details.offers.map((offer) => [`${details.categoryId}:${offer.offerId}`, offer]));
      refreshed.push({ ...product, variations: product.variations.map((variation) => {
        const offer = offers.get(variation.fazercardsSku ?? "");
        const quantity = variation.supplierQuantity ?? 1;
        const permitted = Number.isInteger(quantity) && quantity >= 1 && quantity <= 5
          && (quantity === 1 || (product.type === "topup" && variation.repeatable === true
            && isRepeatableCurrency(variation.basePackageTitle ?? variation.title)));
        const costUsd = permitted && offer && Number.isFinite(offer.priceUsd) && offer.priceUsd > 0
          ? Math.round(offer.priceUsd * 10000 * quantity) / 10000 : 0;
        return { ...variation, costUsd, available: variation.available && costUsd > 0
          && offer?.stock !== 0 && (offer?.stock == null || offer.stock >= quantity) };
      }) });
    } catch {
      refreshed.push({ ...product, available: false, variations: product.variations.map((v) => ({ ...v, available: false })) });
    }
  }
  return refreshed;
}
