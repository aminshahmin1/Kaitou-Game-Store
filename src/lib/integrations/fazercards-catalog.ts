import type { RequiredField } from "@/lib/types";

const defaultBaseUrl = "https://api.fzr.cards/api/v2";

export type FazerCardsCatalogKind = "topup" | "gift_card" | "steam_gift";

type FazerCardsTopupCategory = {
  category_id: string;
  name: string;
  note?: string;
  imageurl?: string | null;
};

type FazerCardsTopupOffer = {
  offer_id?: string | null;
  name: string;
  price_usd: string;
};

type FazerCardsField = {
  key: string;
  label: string;
  type?: string;
  options?: Array<{ label?: string; value?: string; name?: string } | string>;
};

export type FazerCardsCatalogItem = {
  id: string;
  name: string;
  kind: FazerCardsCatalogKind;
  note: string | null;
  imageUrl: string | null;
};

export type FazerCardsCatalogDetails = {
  kind: FazerCardsCatalogKind;
  categoryId: string;
  name: string;
  note: string | null;
  imageUrl: string | null;
  fields: RequiredField[];
  offers: Array<{
    offerId: string | number;
    name: string;
    priceUsd: number;
    stock?: number;
    minOrderQuantity?: number;
    maxOrderQuantity?: number;
    region?: string;
  }>;
};

function getConfig() {
  const apiKey = process.env.FAZERCARDS_API_KEY;
  const apiBaseUrl = process.env.FAZERCARDS_API_BASE_URL ?? defaultBaseUrl;

  if (!apiKey) {
    throw new Error("FazerCards API key is not configured.");
  }

  return { apiKey, apiBaseUrl };
}

async function fazerCardsFetch<T>(path: string) {
  const { apiKey, apiBaseUrl } = getConfig();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      Accept: "application/json",
      "X-API-Key": apiKey,
    },
    cache: "no-store",
  });

  const body = (await response.json().catch(() => null)) as T | null;

  if (!response.ok || !body) {
    throw new Error(`FazerCards request failed for ${path}.`);
  }

  return body;
}

export async function listFazerCardsTopups() {
  return listFazerCardsCatalog("topup");
}

export async function listFazerCardsCatalog(kind: FazerCardsCatalogKind, query = "") {
  if (kind === "steam_gift") {
    const body = await fazerCardsFetch<{
      games?: Array<{ appid: number; name: string }>;
    }>("/steam-gifts/games?limit=500");
    return (body.games ?? [])
      .map((game): FazerCardsCatalogItem => ({
        id: String(game.appid),
        name: game.name,
        kind,
        note: "Steam gift game",
        imageUrl: null,
      }))
      .filter((item) => matchesQuery(item, query))
      .slice(0, 80);
  }

  const params = new URLSearchParams({ limit: "500", include_ui: "1" });
  const path = kind === "gift_card" ? "/giftcards" : "/topups";
  const body = await fazerCardsFetch<{ items?: FazerCardsTopupCategory[] }>(`${path}?${params.toString()}`);

  return (body.items ?? [])
    .map((item): FazerCardsCatalogItem => ({
      id: item.category_id,
      name: item.name,
      kind,
      note: item.note ?? null,
      imageUrl: item.imageurl ?? null,
    }))
    .filter((item) => matchesQuery(item, query))
    .slice(0, 80);
}

export async function getFazerCardsCatalogDetails(
  kind: FazerCardsCatalogKind,
  categoryId: string,
  displayName?: string,
): Promise<FazerCardsCatalogDetails> {
  if (kind === "gift_card") {
    return getFazerCardsGiftCardDetails(categoryId);
  }

  if (kind === "steam_gift") {
    return getFazerCardsSteamGiftDetails(categoryId, displayName);
  }

  return getFazerCardsTopupDetails(categoryId);
}

export async function getFazerCardsTopupDetails(categoryId: string): Promise<FazerCardsCatalogDetails> {
  const params = new URLSearchParams({ category_id: categoryId, include_ui: "1" });
  const body = await fazerCardsFetch<{
    category_id: string;
    name: string;
    note?: string;
    imageurl?: string;
    fields?: FazerCardsField[];
    offers?: FazerCardsTopupOffer[];
  }>(`/topups/offers?${params.toString()}`);

  return {
    kind: "topup",
    categoryId: body.category_id,
    name: body.name,
    note: body.note ?? null,
    imageUrl: body.imageurl ?? null,
    fields: mapFields(body.fields ?? []),
    offers: (body.offers ?? []).map((offer) => ({
      offerId: offer.offer_id ?? offer.name,
      name: offer.name,
      priceUsd: Number(offer.price_usd),
    })),
  };
}

async function getFazerCardsGiftCardDetails(categoryId: string): Promise<FazerCardsCatalogDetails> {
  const params = new URLSearchParams({ category_id: categoryId, include_ui: "1" });
  const body = await fazerCardsFetch<{
    category_id: string;
    name: string;
    note?: string;
    imageurl?: string | null;
    offers?: Array<{
      card_id?: string | null;
      name: string;
      price_usd: string;
      stock?: number;
      min_order_quantity?: number;
      max_order_quantity?: number;
    }>;
  }>(`/giftcards/cards?${params.toString()}`);

  return {
    kind: "gift_card",
    categoryId: body.category_id,
    name: body.name,
    note: body.note ?? null,
    imageUrl: body.imageurl ?? null,
    fields: [],
    offers: (body.offers ?? []).map((offer) => ({
      offerId: offer.card_id ?? offer.name,
      name: offer.name,
      priceUsd: Number(offer.price_usd),
      stock: offer.stock,
      minOrderQuantity: offer.min_order_quantity,
      maxOrderQuantity: offer.max_order_quantity,
    })),
  };
}

async function getFazerCardsSteamGiftDetails(
  appId: string,
  displayName?: string,
): Promise<FazerCardsCatalogDetails> {
  const details = await fazerCardsFetch<{
    appid: number;
    offers?: Array<{
      sub_id: number;
      name: string;
      regions: Array<{ region: string; price: string }>;
    }>;
  }>(`/steam-gifts/games/${encodeURIComponent(appId)}`);
  const gameName = displayName || `Steam app ${details.appid}`;

  return {
    kind: "steam_gift",
    categoryId: String(details.appid),
    name: gameName,
    note: "Steam gift game. Customer must provide a valid Steam invite URL during checkout.",
    imageUrl: null,
    fields: [
      {
        key: "steam_invite_url",
        label: "Steam invite URL",
        placeholder: "Paste the customer's Steam invite URL",
        type: "text",
      },
    ],
    offers: (details.offers ?? []).flatMap((offer) =>
      offer.regions.map((region) => ({
        offerId: `${offer.sub_id}:${region.region}`,
        name: `${offer.name} (${region.region})`,
        priceUsd: Number(region.price),
        region: region.region,
      })),
    ),
  };
}

function mapFields(fields: FazerCardsField[]): RequiredField[] {
  return fields.map((field) => ({
    key: field.key,
    label: field.label,
    placeholder: field.label,
    type: field.type === "number" ? "number" : field.type === "select" ? "select" : "text",
    options: Array.isArray(field.options)
      ? field.options
          .map((option) => {
            if (typeof option === "string") {
              return option;
            }
            return option.value ?? option.label ?? option.name ?? "";
          })
          .filter(Boolean)
      : undefined,
  }));
}

function matchesQuery(item: FazerCardsCatalogItem, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return `${item.name} ${item.id} ${item.note ?? ""}`.toLowerCase().includes(normalized);
}
