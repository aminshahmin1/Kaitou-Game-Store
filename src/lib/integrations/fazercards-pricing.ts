import "server-only";
import type { Product } from "../types";
import { getFazerCardsCatalogDetails } from "./fazercards-catalog";

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
        const costUsd = offer && Number.isFinite(offer.priceUsd) && offer.priceUsd > 0 ? offer.priceUsd : 0;
        return { ...variation, costUsd, available: variation.available && costUsd > 0 && offer?.stock !== 0 };
      }) });
    } catch {
      refreshed.push({ ...product, available: false, variations: product.variations.map((v) => ({ ...v, available: false })) });
    }
  }
  return refreshed;
}
