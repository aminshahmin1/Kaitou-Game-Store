export const FPX_FEE_MYR = 1;

export function getCheckoutPricing(productPriceMyr: number) {
  const subtotalSen = Math.round(productPriceMyr * 100);
  if (!Number.isFinite(productPriceMyr) || !Number.isSafeInteger(subtotalSen) || subtotalSen <= 0 || !Number.isSafeInteger(subtotalSen + 100)) {
    throw new Error("Product price is invalid.");
  }
  return { subtotalMyr: subtotalSen / 100, feeMyr: FPX_FEE_MYR, totalMyr: (subtotalSen + 100) / 100 };
}
