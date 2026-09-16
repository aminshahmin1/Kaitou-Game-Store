import type { Product } from "./types";

export const products: Product[] = [
  {
    id: "mlbb-weekly-diamond-pass",
    slug: "mobile-legends-weekly-diamond-pass",
    title: "Mobile Legends Weekly Diamond Pass",
    type: "topup",
    category: "Game Top-Ups",
    game: "Mobile Legends",
    region: "MY",
    deliveryType: "Direct top-up",
    imageTone: "from-sky-500 via-blue-700 to-slate-950",
    active: true,
    available: true,
    requiredFields: [
      { key: "user_id", label: "User ID", placeholder: "Example: 123456789", type: "number" },
      { key: "zone_id", label: "Zone ID", placeholder: "Example: 1234", type: "number" },
    ],
    variations: [
      {
        id: "starter-mlbb-weekly-diamond-pass",
        title: "Weekly Diamond Pass",
        sku: "starter-mlbb-weekly-diamond-pass",
        fazercardsSku: null,
        priceMyr: 10.9,
        costMyr: 9.1,
        active: true,
        available: true,
      },
    ],
  },
  {
    id: "pubg-uc-60",
    slug: "pubg-mobile-60-uc",
    title: "PUBG Mobile 60 UC",
    type: "topup",
    category: "Game Top-Ups",
    game: "PUBG Mobile",
    region: "MY",
    deliveryType: "Direct top-up",
    imageTone: "from-cyan-500 via-slate-800 to-black",
    active: true,
    available: true,
    requiredFields: [
      { key: "player_id", label: "Player ID", placeholder: "Enter PUBG Mobile player ID", type: "number" },
    ],
    variations: [
      {
        id: "starter-pubg-60-uc",
        title: "60 UC",
        sku: "starter-pubg-60-uc",
        fazercardsSku: null,
        priceMyr: 4.9,
        costMyr: 4.1,
        active: true,
        available: true,
      },
    ],
  },
  {
    id: "free-fire-100-diamonds",
    slug: "free-fire-100-diamonds",
    title: "Free Fire 100 Diamonds",
    type: "topup",
    category: "Game Top-Ups",
    game: "Free Fire",
    region: "MY",
    deliveryType: "Direct top-up",
    imageTone: "from-orange-500 via-red-600 to-slate-950",
    active: true,
    available: true,
    requiredFields: [
      { key: "player_id", label: "Player ID", placeholder: "Enter Free Fire player ID", type: "number" },
    ],
    variations: [
      {
        id: "starter-free-fire-100-diamonds",
        title: "100 Diamonds",
        sku: "starter-free-fire-100-diamonds",
        fazercardsSku: null,
        priceMyr: 4.2,
        costMyr: 3.55,
        active: true,
        available: true,
      },
    ],
  },
  {
    id: "valorant-points-475",
    slug: "valorant-475-points",
    title: "Valorant 475 Points",
    type: "topup",
    category: "Game Top-Ups",
    game: "Valorant",
    region: "MY",
    deliveryType: "Direct top-up",
    imageTone: "from-rose-500 via-slate-900 to-black",
    active: true,
    available: true,
    requiredFields: [
      { key: "riot_id", label: "Riot ID", placeholder: "Example: Kaitou#MY1" },
      {
        key: "region",
        label: "Region",
        placeholder: "Select region",
        type: "select",
        options: ["Malaysia", "Singapore", "Indonesia", "Thailand", "Philippines"],
      },
    ],
    variations: [
      {
        id: "starter-valorant-475-points",
        title: "475 Points",
        sku: "starter-valorant-475-points",
        fazercardsSku: null,
        priceMyr: 19.9,
        costMyr: 17.6,
        active: true,
        available: true,
      },
    ],
  },
  {
    id: "honkai-express-pass",
    slug: "honkai-star-rail-express-supply-pass",
    title: "Honkai: Star Rail Express Supply Pass",
    type: "topup",
    category: "Game Top-Ups",
    game: "Honkai: Star Rail",
    region: "SEA",
    deliveryType: "Direct top-up",
    imageTone: "from-violet-500 via-blue-900 to-black",
    active: true,
    available: true,
    requiredFields: [
      { key: "uid", label: "UID", placeholder: "Enter Honkai UID", type: "number" },
      {
        key: "server",
        label: "Server",
        placeholder: "Select server",
        type: "select",
        options: ["Asia", "America", "Europe", "TW/HK/MO"],
      },
    ],
    variations: [
      {
        id: "starter-honkai-express-pass",
        title: "Express Supply Pass",
        sku: "starter-honkai-express-pass",
        fazercardsSku: null,
        priceMyr: 19.9,
        costMyr: 17.2,
        active: true,
        available: true,
      },
    ],
  },
  {
    id: "steam-gift-game",
    slug: "steam-gift-game",
    title: "Steam Gift Game",
    type: "steam_gift_game",
    category: "Steam Gift Games",
    game: "Steam",
    region: "Global",
    deliveryType: "Steam gift",
    imageTone: "from-slate-700 via-blue-950 to-black",
    active: true,
    available: true,
    requiredFields: [
      {
        key: "steam_profile",
        label: "Steam Profile URL or Friend Code",
        placeholder: "Paste your Steam profile URL or friend code",
        help: "Make sure your profile can receive gifts for the selected region.",
      },
    ],
    variations: [
      {
        id: "starter-steam-gift-game",
        title: "Steam Gift Game",
        sku: "starter-steam-gift-game",
        fazercardsSku: null,
        priceMyr: 59.9,
        costMyr: 52,
        active: true,
        available: true,
      },
    ],
  },
];

export function getActiveProducts() {
  return products.filter((product) => product.active);
}

export function getProductBySlug(slug: string) {
  return products.find((product) => product.slug === slug && product.active);
}

export function getProductStartingPrice(product: Product) {
  const prices = product.variations
    .filter((variation) => variation.active && variation.available)
    .map((variation) => variation.priceMyr);

  return prices.length > 0 ? Math.min(...prices) : 0;
}

export function formatMyr(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(value);
}
