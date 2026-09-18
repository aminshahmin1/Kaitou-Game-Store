import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminApiSession } from "@/lib/auth/admin-api";
import { importFazerCardsCatalogDraft, searchFazerCardsCatalog } from "@/lib/products";

const catalogQuerySchema = z.object({
  kind: z.enum(["all", "topup", "gift_card", "steam_gift"]).default("all"),
  q: z.string().max(120).default(""),
});

const importSchema = z.object({
  kind: z.enum(["topup", "gift_card", "steam_gift"]),
  categoryId: z.string().min(1).max(180),
  displayName: z.string().min(1).max(180).optional(),
});

export async function GET(request: Request) {
  const session = await getAdminApiSession("products");

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = catalogQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid catalog search." }, { status: 400 });
  }

  try {
    const result = await searchFazerCardsCatalog(parsed.data.kind, parsed.data.q);
    const items = Array.isArray(result) ? result : result.items;
    const warnings = Array.isArray(result) ? [] : result.warnings;
    return NextResponse.json({ items, warnings });
  } catch (error) {
    console.error("FazerCards catalog search failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "FazerCards catalog could not be searched." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getAdminApiSession("products");

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = importSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid catalog import." }, { status: 400 });
  }

  try {
    const result = await importFazerCardsCatalogDraft(
      parsed.data.kind,
      parsed.data.categoryId,
      parsed.data.displayName,
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("FazerCards catalog import failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "FazerCards item could not be imported." }, { status: 500 });
  }
}
