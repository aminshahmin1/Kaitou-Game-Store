import "server-only";
import { z } from "zod";
import type { FazerCardsOrderInput, FazerCardsOrderResult } from "./fazercards";

const childSchema = z.object({
  index: z.number().int().min(1).max(5),
  status: z.enum(["pending", "processing", "completed", "review"]),
  reference: z.string().regex(/^ord-[0-9]+$/).nullable(),
  chargedUsd: z.number().finite().positive().nullable(),
  message: z.string(),
});
const progressSchema = z.object({
  kind: z.literal("bundle"), orderId: z.string(), quantity: z.number().int().min(2).max(5),
  sku: z.string(), children: z.array(childSchema).min(2).max(5),
});
export type BundleProgress = z.infer<typeof progressSchema>;

export async function fulfillCustomPackage(
  input: FazerCardsOrderInput,
  createOne: (input: FazerCardsOrderInput) => Promise<FazerCardsOrderResult>,
  getOne: (reference: string) => Promise<FazerCardsOrderResult>,
): Promise<FazerCardsOrderResult> {
  const quantity = input.variation.supplierQuantity ?? 1;
  if (input.product.type !== "topup" || !Number.isInteger(quantity) || quantity < 2 || quantity > 5) {
    throw new Error("Unsupported custom package.");
  }
  const sku = input.variation.fazercardsSku || input.variation.sku;
  const progress: BundleProgress = input.previous === undefined ? {
    kind: "bundle", orderId: input.orderId, quantity, sku,
    children: Array.from({ length: quantity }, (_, i) => ({ index: i + 1, status: "pending", reference: null, chargedUsd: null, message: "Awaiting delivery" })),
  } : progressSchema.parse(input.previous);
  if (progress.orderId !== input.orderId || progress.quantity !== quantity || progress.sku !== sku
    || progress.children.length !== quantity || progress.children.some((c, i) => c.index !== i + 1
      || (["completed", "processing"].includes(c.status) && !c.reference))
    || new Set(progress.children.filter((c) => c.reference).map((c) => c.reference)).size !== progress.children.filter((c) => c.reference).length) {
    throw new Error("Custom package history does not match its original order.");
  }
  const missing = progress.children.filter((c) => !c.reference);
  // Bound each invocation to two purchase calls; further parts continue in the worker.
  if (!progress.children.some((c) => c.reference && c.status === "review") && missing.length) {
    for (const child of missing.slice(0, 2)) {
      try {
        const result = await createOne({ ...input, previous: undefined,
          orderId: `${input.orderId}:part:${child.index}`, variation: { ...input.variation, supplierQuantity: 1 } });
        if (!/^ord-[0-9]+$/.test(result.providerReference)) throw new Error("No confirmed supplier reference.");
        if (progress.children.some((other) => other.index !== child.index && other.reference === result.providerReference)) {
          throw new Error("Supplier repeated a delivery reference for different parts.");
        }
        child.reference = result.providerReference;
        child.status = result.status === "failed" ? "review" : result.status;
        child.chargedUsd = result.chargedUsd ?? null;
        child.message = result.message;
        if (child.status === "review") break;
      } catch {
        child.status = "review";
        child.message = "Delivery could not be confirmed. Check supplier history before manual fulfillment. A retry must use the original part key.";
        break;
      }
    }
  } else if (!missing.length) {
    for (const child of progress.children) {
      if ((child.status === "completed" && child.chargedUsd !== null) || child.status === "review" || !child.reference) continue;
      try {
        const result = await getOne(child.reference);
        if (result.providerReference !== child.reference) throw new Error("Reference mismatch.");
        if (child.chargedUsd !== null && result.chargedUsd !== undefined
          && Math.round(child.chargedUsd * 10000) !== Math.round(result.chargedUsd * 10000)) {
          child.status = "review";
          child.message = "Supplier cost changed. Reconcile this part before changing profit.";
          continue;
        }
        child.status = result.status === "failed" ? "review" : result.status;
        child.chargedUsd ??= result.chargedUsd ?? null;
        child.message = result.message;
      } catch {
        child.message = "Awaiting the next supplier status check.";
      }
    }
  }
  const review = progress.children.some((c) => c.status === "review");
  const completed = progress.children.filter((c) => c.status === "completed").length;
  const costConfirmed = !review && progress.children.every((c) => c.reference && c.chargedUsd !== null);
  return {
    setupRequired: false, providerReference: `bundle-${input.orderId}`,
    status: review ? "review" : completed === quantity && costConfirmed ? "completed" : "processing",
    message: `${completed} of ${quantity} deliveries completed.${review ? " Support review required; do not repeat successful deliveries." : ""}`,
    raw: progress,
    ...(costConfirmed ? { chargedUsd: progress.children.reduce((sum, c) => sum + Math.round(c.chargedUsd! * 10000), 0) / 10000 } : {}),
  };
}
