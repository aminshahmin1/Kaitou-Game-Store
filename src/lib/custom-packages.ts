export const maxPackageQuantity = 5;

export function isRepeatableCurrency(title: string) {
  return !/pass|subscription|membership|weekly|monthly|elite|twilight|first[ -]?(purchase|top.?up)/i.test(title);
}

export function isRankingCurrency(title: string) {
  return isRepeatableCurrency(title) && !/\bpacks?\b/i.test(title);
}

type Package = {
  title: string; fazercardsSku?: string | null; costUsd: number; costMyr: number;
  supplierQuantity?: number; repeatable?: boolean; basePackageTitle?: string | null;
  currencyUnits?: number;
};

export function normalizeCustomPackages<T extends Package>(type: string, variations: T[]): T[] {
  return variations.map((variation) => {
    const quantity = variation.supplierQuantity ?? 1;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > maxPackageQuantity) throw new Error("Package quantity must be between 1 and 5.");
    if (quantity === 1 && (!Number.isInteger(variation.currencyUnits ?? 0) || (variation.currencyUnits ?? 0) < 0
      || (variation.currencyUnits ?? 0) > 1_000_000_000)) throw new Error("Currency units must be a whole number from 0 to 1000000000.");
    if (quantity === 1) return { ...variation, supplierQuantity: 1, basePackageTitle: null,
      currencyUnits: type === "topup" && isRankingCurrency(variation.title) ? variation.currencyUnits ?? 0 : 0 };
    const base = variations.find((item) => (item.supplierQuantity ?? 1) === 1
      && item.fazercardsSku && item.fazercardsSku === variation.fazercardsSku);
    if (type !== "topup" || !base?.repeatable || !isRepeatableCurrency(base.title)) {
      throw new Error("Custom packages require an approved repeatable currency top-up from this product. Passes and subscriptions cannot be repeated.");
    }
    return { ...variation, supplierQuantity: quantity, repeatable: true, basePackageTitle: base.title,
      currencyUnits: isRankingCurrency(base.title) ? (base.currencyUnits ?? 0) * quantity : 0,
      costUsd: Math.round(base.costUsd * 10000 * quantity) / 10000,
      costMyr: Math.round(base.costMyr * 100 * quantity) / 100 };
  });
}
