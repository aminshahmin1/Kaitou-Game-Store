export type ProductType = "topup" | "steam_gift_game";

export type RequiredField = {
  key: string;
  label: string;
  placeholder: string;
  help?: string;
  type?: "text" | "number" | "select";
  options?: string[];
};

export type Product = {
  id: string;
  slug: string;
  title: string;
  type: ProductType;
  category: "Game Top-Ups" | "Steam Gift Games";
  game: string;
  region: "MY" | "SEA" | "Global";
  deliveryType: "Direct top-up" | "Steam gift";
  imageTone: string;
  description?: string | null;
  active: boolean;
  available: boolean;
  fazercardsProductId?: string | null;
  requiredFields: RequiredField[];
  variations: ProductVariation[];
};

export type ProductVariation = {
  id: string;
  title: string;
  sku: string;
  fazercardsSku?: string | null;
  priceMyr: number;
  costMyr: number;
  active: boolean;
  available: boolean;
};

export type OrderStatus =
  | "processing"
  | "completed"
  | "failed"
  | "review"
  | "refunded";

export type CheckoutPayload = {
  productSlug: string;
  variationId: string;
  customerName: string;
  customerEmail: string;
  whatsapp: string;
  locale: "en" | "ms";
  fieldValues: Record<string, string>;
};

export type CheckoutResult = {
  orderId: string;
  paymentUrl: string;
  paymentSetupRequired: boolean;
};
