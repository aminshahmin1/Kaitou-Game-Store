import { z } from "zod";

export const checkoutSchema = z.object({
  productSlug: z.string().min(1).max(180),
  variationId: z.string().min(1).max(80),
  customerName: z.string().trim().min(2).max(80),
  customerEmail: z.email().max(120),
  whatsapp: z
    .string()
    .min(8)
    .max(20)
    .regex(/^[0-9+\-\s]+$/, "Use a valid WhatsApp number"),
  locale: z.enum(["en", "ms"]).default("en"),
  fieldValues: z.record(z.string().max(60), z.string().max(1000))
    .refine((fields) => Object.keys(fields).length <= 30, "Too many customer fields."),
});

const requiredFieldSchema = z.object({
  key: z.string().min(1).max(60),
  label: z.string().min(1).max(80),
  placeholder: z.string().min(1).max(120),
  help: z.string().max(180).optional(),
  type: z.enum(["text", "number", "select"]).optional(),
  options: z.array(z.string().min(1).max(80)).optional(),
});

const variationSchema = z.object({
  currencyUnits: z.number().int().min(0).max(5_000_000_000).default(0),
  supplierQuantity: z.number().int().min(1).max(5).default(1),
  repeatable: z.boolean().default(false),
  basePackageTitle: z.string().max(120).nullable().optional(),
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(120),
  sku: z.string().min(1).max(120),
  fazercardsSku: z.string().max(160).optional(),
  costUsd: z.coerce.number().min(0).default(0),
  priceMyr: z.coerce.number().min(0),
  costMyr: z.coerce.number().min(0).default(0),
  active: z.boolean().default(true),
  available: z.boolean().default(true),
});

const adminProductBaseSchema = z.object({
  leaderboardUnit: z.string().trim().max(40).default(""),
  title: z.string().min(2).max(160),
  slug: z.string().min(2).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  type: z.enum(["topup", "steam_gift_game"]),
  category: z.string().min(2).max(80),
  game: z.string().min(1).max(120),
  description: z.string().max(600).optional(),
  imageTone: z.string().min(1).max(160),
  region: z.enum(["MY", "SEA", "Global"]),
  deliveryType: z.enum(["Direct top-up", "Steam gift"]),
  fazercardsProductId: z.string().max(160).optional(),
  requiredFields: z.array(requiredFieldSchema).default([]),
  variations: z.array(variationSchema).min(1),
  active: z.boolean().default(true),
  available: z.boolean().default(true),
});

export const adminProductCreateSchema = adminProductBaseSchema;

export const adminProductUpdateSchema = adminProductBaseSchema;
