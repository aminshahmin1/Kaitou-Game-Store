import { z } from "zod";
import type { RequiredField } from "./types";

const reservedKeys = new Set(["__proto__", "prototype", "constructor", "variationId", "customerName", "customerEmail", "whatsapp", "locale"]);

export function validateCheckoutFields(fields: RequiredField[], input: unknown):
  { success: true; values: Record<string, string> } | { success: false; error: string } {
  const keys = fields.map((field) => field.key);
  if (fields.length > 30 || new Set(keys).size !== keys.length ||
      keys.some((key) => !/^[a-zA-Z0-9_-]{1,60}$/.test(key) || reservedKeys.has(key))) {
    return { success: false, error: "This product's customer fields need support review." };
  }
  const entries = fields.map((field) => {
    let schema = z.string().trim().min(1, `${field.label} is required.`)
      .max(1000, `${field.label} is too long.`);
    if (field.type === "number") {
      // IDs stay strings: numeric coercion would lose leading zeroes and large integers.
      schema = schema.regex(/^\d+$/, `${field.label} must contain digits only.`);
    }
    if (field.type === "select") {
      schema = schema.refine((value) => (field.options ?? []).includes(value), `Choose a valid ${field.label}.`);
    }
    return [field.key, schema] as const;
  });
  const result = z.strictObject(Object.fromEntries(entries)).safeParse(input);
  return result.success
    ? { success: true, values: result.data }
    : { success: false, error: result.error.issues[0]?.code === "unrecognized_keys"
      ? "Unexpected customer fields. Refresh the product page and try again."
      : result.error.issues[0]?.message ?? "Please check your game details." };
}
