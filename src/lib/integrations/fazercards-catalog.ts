import type { RequiredField } from "@/lib/types";

const defaultBaseUrl = "https://api.fzr.cards/api/v2";

type FazerCardsTopupCategory = {
  category_id: string;
  name: string;
  note?: string;
};

type FazerCardsTopupOffer = {
  offer_id: string;
  name: string;
  price_usd: string;
};

type FazerCardsField = {
  key: string;
  label: string;
  type?: string;
};

export type FazerCardsTopupDetails = {
  categoryId: string;
  name: string;
  note: string | null;
  imageUrl: string | null;
  fields: RequiredField[];
  offers: Array<{
    offerId: string;
    name: string;
    priceUsd: number;
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
  const body = await fazerCardsFetch<{ items?: FazerCardsTopupCategory[] }>("/topups");
  return body.items ?? [];
}

export async function getFazerCardsTopupDetails(categoryId: string): Promise<FazerCardsTopupDetails> {
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
    categoryId: body.category_id,
    name: body.name,
    note: body.note ?? null,
    imageUrl: body.imageurl ?? null,
    fields: (body.fields ?? []).map((field) => ({
      key: field.key,
      label: field.label,
      placeholder: field.label,
      type: field.type === "number" ? "number" : "text",
    })),
    offers: (body.offers ?? []).map((offer) => ({
      offerId: offer.offer_id,
      name: offer.name,
      priceUsd: Number(offer.price_usd),
    })),
  };
}
