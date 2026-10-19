import { normalizeCustomPackages } from "./custom-packages";
import { getAvailableSupplierCredit } from "./supplier-credit";
import { getFundingCostBasis } from "./funding-cost";
import { estimateCostMyr } from "./cost-conversion";
import { applyBalanceAvailability } from "./stock";
import { refreshSupplierPrices } from "./integrations/fazercards-pricing";
import {
  getFazerCardsCatalogDetails,
  listFazerCardsCatalog,
  searchAllFazerCardsCatalog,
  type FazerCardsCatalogKind,
} from "./integrations/fazercards-catalog";
import { createSupabaseAdminClient } from "./supabase/admin";
import type { Product, ProductVariation, RequiredField } from "./types";
import { adminProductCreateSchema, adminProductUpdateSchema } from "./validation";

type ProductRow = {
  image_url?: string | null;
  leaderboard_unit?: string;
  id: string;
  slug: string;
  title: string;
  type: "topup" | "steam_gift_game";
  category: string;
  game: string;
  description: string | null;
  image_tone: string;
  region: "MY" | "SEA" | "Global";
  delivery_type: "Direct top-up" | "Steam gift";
  fazercards_product_id: string | null;
  required_fields: RequiredField[];
  active: boolean;
  available: boolean;
  product_variations: VariationRow[];
};

type VariationRow = {
  currency_units?: number;
  supplier_quantity?: number;
  repeatable?: boolean;
  base_package_title?: string | null;
  id: string;
  title: string;
  sku: string;
  fazercards_sku: string | null;
  cost_usd: string | number | null;
  price_myr: string | number;
  cost_myr: string | number;
  active: boolean;
  available: boolean;
};

export async function getStoreProducts() {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("products")
    .select(
      "id, slug, title, type, category, game, description, image_tone, region, delivery_type, fazercards_product_id, required_fields, image_url, leaderboard_unit, active, available, product_variations(id, title, sku, fazercards_sku, cost_usd, price_myr, cost_myr, active, available, supplier_quantity, repeatable, base_package_title, currency_units)",
    )
    .eq("active", true)
    .eq("available", true)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true })
    .order("sort_order", { referencedTable: "product_variations", ascending: true });

  if (error) {
    console.error("Failed to load products", { message: error.message });
    return [];
  }

  const products = (data as ProductRow[])
    .map((row) => mapProductRow(row))
    .filter((product) => product.variations.length > 0);
  const refreshed = await refreshSupplierPrices(products);
  const availableCredit = await getAvailableSupplierCredit().catch(() => null);
  return applyBalanceAvailability(refreshed, availableCredit);
}

export async function getStoreProductBySlug(slug: string) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("products")
    .select(
      "id, slug, title, type, category, game, description, image_tone, region, delivery_type, fazercards_product_id, required_fields, image_url, leaderboard_unit, active, available, product_variations(id, title, sku, fazercards_sku, cost_usd, price_myr, cost_myr, active, available, supplier_quantity, repeatable, base_package_title, currency_units)",
    )
    .eq("slug", slug)
    .eq("active", true)
    .eq("available", true)
    .order("sort_order", { referencedTable: "product_variations", ascending: true })
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const refreshed = await refreshSupplierPrices([mapProductRow(data as ProductRow)]);
  const availableCredit = await getAvailableSupplierCredit().catch(() => null);
  return applyBalanceAvailability(refreshed, availableCredit)[0];
}

export async function getAdminProducts() {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("products")
    .select(
      "id, slug, title, type, category, game, description, image_tone, region, delivery_type, fazercards_product_id, required_fields, image_url, leaderboard_unit, active, available, product_variations(id, title, sku, fazercards_sku, cost_usd, price_myr, cost_myr, active, available, supplier_quantity, repeatable, base_package_title, currency_units)",
    )
    .order("created_at", { ascending: false })
    .order("sort_order", { referencedTable: "product_variations", ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data as ProductRow[]).map((row) => mapProductRow(row, { includeUnavailableVariations: true }));
}

export async function createAdminProduct(input: unknown) {
  const parsed = adminProductCreateSchema.parse(input);
  parsed.variations = normalizeCustomPackages(parsed.type, parsed.variations);
  const basis = await getFundingCostBasis();
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({
      slug: parsed.slug,
      title: parsed.title,
      type: parsed.type,
      category: parsed.category,
      game: parsed.game,
      description: parsed.description ?? null,
      image_tone: parsed.imageTone,
      image_url: parsed.imageUrl || null,
      region: parsed.region,
      delivery_type: parsed.deliveryType,
      fazercards_product_id: parsed.fazercardsProductId || null,
      required_fields: parsed.requiredFields,
      leaderboard_unit: parsed.leaderboardUnit,
      active: parsed.active,
      available: parsed.available,
      source: "manual",
    })
    .select("id")
    .single();

  if (productError) {
    throw new Error(productError.message);
  }

  const { error: variationError } = await supabase.from("product_variations").insert(
    parsed.variations.map((variation, index) => ({
      product_id: product.id,
      title: variation.title,
      sku: variation.sku,
      fazercards_sku: variation.fazercardsSku || null,
      supplier_quantity: variation.supplierQuantity, repeatable: variation.repeatable,
      currency_units: variation.currencyUnits ?? 0,
      base_package_title: variation.basePackageTitle ?? null,
      cost_usd: variation.costUsd,
      price_myr: variation.priceMyr,
      cost_myr: basis && variation.costUsd > 0 ? estimateCostMyr(variation.costUsd, basis.rate) : variation.costMyr,
      active: variation.active,
      available: variation.available,
      sort_order: index,
    })),
  );

  if (variationError) {
    throw new Error(variationError.message);
  }

  return product.id as string;
}

export async function updateAdminProduct(productId: string, input: unknown) {
  const parsed = adminProductUpdateSchema.parse(input);
  parsed.variations = normalizeCustomPackages(parsed.type, parsed.variations);
  const basis = await getFundingCostBasis();
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { error: productError } = await supabase
    .from("products")
    .update({
      slug: parsed.slug,
      title: parsed.title,
      type: parsed.type,
      category: parsed.category,
      game: parsed.game,
      description: parsed.description ?? null,
      image_tone: parsed.imageTone,
      image_url: parsed.imageUrl || null,
      region: parsed.region,
      delivery_type: parsed.deliveryType,
      fazercards_product_id: parsed.fazercardsProductId || null,
      required_fields: parsed.requiredFields,
      leaderboard_unit: parsed.leaderboardUnit,
      active: parsed.active,
      available: parsed.available,
    })
    .eq("id", productId);

  if (productError) {
    throw new Error(productError.message);
  }

  for (const [index, variation] of parsed.variations.entries()) {
    const row = {
      product_id: productId,
      title: variation.title,
      sku: variation.sku,
      fazercards_sku: variation.fazercardsSku || null,
      supplier_quantity: variation.supplierQuantity, repeatable: variation.repeatable,
      currency_units: variation.currencyUnits ?? 0,
      base_package_title: variation.basePackageTitle ?? null,
      cost_usd: variation.costUsd,
      price_myr: variation.priceMyr,
      cost_myr: basis && variation.costUsd > 0 ? estimateCostMyr(variation.costUsd, basis.rate) : variation.costMyr,
      active: variation.active,
      available: variation.available,
      sort_order: index,
    };

    const query = variation.id
      ? supabase.from("product_variations").update(row).eq("id", variation.id).eq("product_id", productId)
      : supabase.from("product_variations").upsert(row, { onConflict: "product_id,sku" });

    const { error: variationError } = await query;

    if (variationError) {
      throw new Error(variationError.message);
    }
  }
}

export async function updateAdminProductStatus(
  productId: string,
  input: { active?: boolean; available?: boolean },
) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const update: { active?: boolean; available?: boolean } = {};

  if (typeof input.active === "boolean") {
    update.active = input.active;
  }

  if (typeof input.available === "boolean") {
    update.available = input.available;
  }

  if (Object.keys(update).length === 0) {
    throw new Error("No product fields to update.");
  }

  if (update.active === true && update.available === true) {
    const { data: variations, error: variationError } = await supabase
      .from("product_variations")
      .select("id, price_myr, active, available")
      .eq("product_id", productId);

    if (variationError) {
      throw new Error(variationError.message);
    }

    let publishableVariations = (variations ?? []).filter(
      (variation) => variation.active && variation.available,
    );

    if (publishableVariations.length === 0) {
      const positiveActiveVariationIds = (variations ?? [])
        .filter((variation) => variation.active && Number(variation.price_myr) > 0)
        .map((variation) => variation.id);

      if (positiveActiveVariationIds.length > 0) {
        const { error: availabilityError } = await supabase
          .from("product_variations")
          .update({ available: true })
          .in("id", positiveActiveVariationIds);

        if (availabilityError) {
          throw new Error(availabilityError.message);
        }

        publishableVariations = (variations ?? []).filter(
          (variation) => variation.active && Number(variation.price_myr) > 0,
        );
      }
    }

    if (
      publishableVariations.length === 0 ||
      publishableVariations.some((variation) => Number(variation.price_myr) <= 0)
    ) {
      throw new Error("Review product variations and set positive prices before publishing.");
    }
  }

  const { error } = await supabase.from("products").update(update).eq("id", productId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteAdminProduct(productId: string) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { error } = await supabase.from("products").delete().eq("id", productId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function importFazerCardsMobileLegendsMalaysiaDraft() {
  return importFazerCardsCatalogDraft("topup", "mobile_legends_malaysia");
}

export async function searchFazerCardsCatalog(kind: FazerCardsCatalogKind | "all", query = "") {
  if (kind === "all") {
    return searchAllFazerCardsCatalog(query);
  }

  return listFazerCardsCatalog(kind, query);
}

export async function importFazerCardsCatalogDraft(
  kind: FazerCardsCatalogKind,
  categoryId: string,
  displayName?: string,
) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const details = await getFazerCardsCatalogDetails(kind, categoryId, displayName);
  const basis = await getFundingCostBasis();
  const slug = makeSlug(details.name, details.categoryId);
  const isSteamGift = kind === "steam_gift";

  const { error: existingError } = await supabase.from("products")
    .select("id").eq("slug", slug).maybeSingle();
  if (existingError) throw new Error(existingError.message);

  const { error: productError } = await supabase
    .from("products")
    .upsert(
      {
        slug,
        title: details.name,
        type: isSteamGift ? "steam_gift_game" : "topup",
        category: isSteamGift ? "Steam Gift Games" : "Game Top-Ups",
        game: details.name,
        description:
          details.note ??
          "Imported from FazerCards as a hidden draft. Review sale prices and availability before publishing.",
        image_tone: isSteamGift ? "from-slate-700 via-sky-700 to-slate-950" : "from-sky-400 via-blue-600 to-slate-950",
        image_url: details.imageUrl ?? (isSteamGift ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${Number(details.categoryId)}/header.jpg` : null),
        region: inferRegion(details.name),
        delivery_type: isSteamGift ? "Steam gift" : "Direct top-up",
        required_fields: details.fields,
        source: "fazercards",
        fazercards_product_id: details.categoryId,
        active: false,
        available: false,
      },
      { onConflict: "slug", ignoreDuplicates: true },
    );

  if (productError) {
    throw new Error(productError.message);
  }

  const { data: product, error: lookupError } = await supabase.from("products")
    .select("id").eq("slug", slug).single();
  if (lookupError || !product) throw new Error("Imported product could not be loaded.");

  const variations = details.offers.map((offer, index) => {
    const estimatedCostMyr = basis ? estimateCostMyr(offer.priceUsd, basis.rate) : 0;
    const providerSku =
      kind === "steam_gift"
        ? `${details.categoryId}:${offer.offerId}`
        : `${details.categoryId}:${offer.offerId}`;

    return {
      product_id: product.id,
      title: offer.name,
      sku: makeSlug(details.categoryId, String(offer.offerId)),
      fazercards_sku: providerSku,
      cost_usd: offer.priceUsd,
      price_myr: 0,
      cost_myr: estimatedCostMyr,
      active: true,
      available: true,
      sort_order: index,
    };
  });

  const { error: variationError } = await supabase
    .from("product_variations")
    .upsert(variations, { onConflict: "product_id,sku", ignoreDuplicates: true });

  if (variationError) {
    throw new Error(variationError.message);
  }

  // Refresh supplier costs without replacing the seller's price or visibility choices.
  for (const variation of variations) {
    const { error } = await supabase.from("product_variations")
      .update({ cost_usd: variation.cost_usd, ...(basis ? { cost_myr: variation.cost_myr } : {}) })
      .eq("product_id", product.id).eq("sku", variation.sku);
    if (error) throw new Error(error.message);
  }

  return {
    productId: product.id as string,
    productTitle: details.name,
    variationCount: variations.length,
  };
}

function mapProductRow(
  row: ProductRow,
  options: { includeUnavailableVariations?: boolean } = {},
): Product {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    type: row.type,
    category: row.category as Product["category"],
    game: row.game,
    description: row.description,
    region: row.region,
    deliveryType: row.delivery_type,
    imageTone: row.image_tone,
    imageUrl: row.image_url ?? null,
    active: row.active,
    available: row.available,
    fazercardsProductId: row.fazercards_product_id,
    requiredFields: row.required_fields ?? [],
    leaderboardUnit: row.leaderboard_unit ?? "",
    variations: (row.product_variations ?? [])
      .map(mapVariationRow)
      .filter(
        (variation) =>
          options.includeUnavailableVariations ||
          (variation.active && variation.available && variation.priceMyr > 0),
      ),
  };
}

function mapVariationRow(row: VariationRow): ProductVariation {
  return {
    supplierQuantity: row.supplier_quantity ?? 1, repeatable: row.repeatable ?? false,
    currencyUnits: Number(row.currency_units ?? 0),
    basePackageTitle: row.base_package_title ?? null,
    id: row.id,
    title: row.title,
    sku: row.sku,
    fazercardsSku: row.fazercards_sku,
    costUsd: Number(row.cost_usd ?? 0),
    priceMyr: Number(row.price_myr),
    costMyr: Number(row.cost_myr),
    active: row.active,
    available: row.available,
  };
}

function makeSlug(...parts: string[]) {
  return parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 170);
}

function inferRegion(name: string): "MY" | "SEA" | "Global" {
  const normalized = name.toLowerCase();
  if (normalized.includes("malaysia") || normalized.includes("(my)") || normalized.includes(" my")) {
    return "MY";
  }

  if (
    normalized.includes("sea") ||
    normalized.includes("singapore") ||
    normalized.includes("indonesia") ||
    normalized.includes("thailand") ||
    normalized.includes("philippines")
  ) {
    return "SEA";
  }

  return "Global";
}
