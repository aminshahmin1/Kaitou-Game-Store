import { getActiveProducts, getProductBySlug as getStarterProductBySlug } from "./catalog";
import { getFazerCardsTopupDetails } from "./integrations/fazercards-catalog";
import { createSupabaseAdminClient } from "./supabase/admin";
import type { Product, ProductVariation, RequiredField } from "./types";
import { adminProductCreateSchema, adminProductUpdateSchema } from "./validation";

type ProductRow = {
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
  id: string;
  title: string;
  sku: string;
  fazercards_sku: string | null;
  price_myr: string | number;
  cost_myr: string | number;
  active: boolean;
  available: boolean;
};

export async function getStoreProducts() {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return getActiveProducts();
  }

  const { data, error } = await supabase
    .from("products")
    .select(
      "id, slug, title, type, category, game, description, image_tone, region, delivery_type, fazercards_product_id, required_fields, active, available, product_variations(id, title, sku, fazercards_sku, price_myr, cost_myr, active, available)",
    )
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true })
    .order("sort_order", { referencedTable: "product_variations", ascending: true });

  if (error) {
    console.error("Failed to load products", { message: error.message });
    return [];
  }

  return (data as ProductRow[])
    .map((row) => mapProductRow(row))
    .filter((product) => product.variations.length > 0);
}

export async function getStoreProductBySlug(slug: string) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return getStarterProductBySlug(slug);
  }

  const { data, error } = await supabase
    .from("products")
    .select(
      "id, slug, title, type, category, game, description, image_tone, region, delivery_type, fazercards_product_id, required_fields, active, available, product_variations(id, title, sku, fazercards_sku, price_myr, cost_myr, active, available)",
    )
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapProductRow(data as ProductRow);
}

export async function getAdminProducts() {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("products")
    .select(
      "id, slug, title, type, category, game, description, image_tone, region, delivery_type, fazercards_product_id, required_fields, active, available, product_variations(id, title, sku, fazercards_sku, price_myr, cost_myr, active, available)",
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data as ProductRow[]).map((row) => mapProductRow(row, { includeUnavailableVariations: true }));
}

export async function createAdminProduct(input: unknown) {
  const parsed = adminProductCreateSchema.parse(input);
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
      region: parsed.region,
      delivery_type: parsed.deliveryType,
      fazercards_product_id: parsed.fazercardsProductId || null,
      required_fields: parsed.requiredFields,
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
      price_myr: variation.priceMyr,
      cost_myr: variation.costMyr,
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
      region: parsed.region,
      delivery_type: parsed.deliveryType,
      fazercards_product_id: parsed.fazercardsProductId || null,
      required_fields: parsed.requiredFields,
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
      price_myr: variation.priceMyr,
      cost_myr: variation.costMyr,
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
      .select("price_myr, active, available")
      .eq("product_id", productId);

    if (variationError) {
      throw new Error(variationError.message);
    }

    const publishableVariations = (variations ?? []).filter(
      (variation) => variation.active && variation.available,
    );

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
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const details = await getFazerCardsTopupDetails("mobile_legends_malaysia");
  const usdToMyrRate = Number(process.env.FAZERCARDS_USD_TO_MYR_RATE ?? "4.8");
  const slug = "mobile-legends-malaysia";

  const { data: product, error: productError } = await supabase
    .from("products")
    .upsert(
      {
        slug,
        title: "Mobile Legends (Malaysia)",
        type: "topup",
        category: "Game Top-Ups",
        game: "Mobile Legends",
        description:
          "Direct Mobile Legends diamond top-ups for Malaysia. Prices imported from FazerCards as a draft and should be reviewed before publishing.",
        image_tone: "from-sky-400 via-blue-600 to-slate-950",
        region: "MY",
        delivery_type: "Direct top-up",
        required_fields: details.fields,
        source: "fazercards",
        fazercards_product_id: details.categoryId,
        active: false,
        available: false,
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();

  if (productError) {
    throw new Error(productError.message);
  }

  const variations = details.offers.map((offer, index) => {
    const estimatedCostMyr = Number((offer.priceUsd * usdToMyrRate).toFixed(2));

    return {
      product_id: product.id,
      title: offer.name,
      sku: `${details.categoryId}-${offer.offerId}`,
      fazercards_sku: `${details.categoryId}:${offer.offerId}`,
      price_myr: estimatedCostMyr,
      cost_myr: estimatedCostMyr,
      active: true,
      available: false,
      sort_order: index,
    };
  });

  const { error: variationError } = await supabase
    .from("product_variations")
    .upsert(variations, { onConflict: "product_id,sku" });

  if (variationError) {
    throw new Error(variationError.message);
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
    active: row.active,
    available: row.available,
    fazercardsProductId: row.fazercards_product_id,
    requiredFields: row.required_fields ?? [],
    variations: (row.product_variations ?? [])
      .map(mapVariationRow)
      .filter((variation) => options.includeUnavailableVariations || (variation.active && variation.available)),
  };
}

function mapVariationRow(row: VariationRow): ProductVariation {
  return {
    id: row.id,
    title: row.title,
    sku: row.sku,
    fazercardsSku: row.fazercards_sku,
    priceMyr: Number(row.price_myr),
    costMyr: Number(row.cost_myr),
    active: row.active,
    available: row.available,
  };
}
