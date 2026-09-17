import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminSessionCookieName, verifyAdminSession } from "@/lib/auth/admin-session";
import { importFazerCardsCatalogDraft, searchFazerCardsCatalog } from "@/lib/products";

const catalogQuerySchema = z.object({
  kind: z.enum(["topup", "gift_card", "steam_gift"]).default("topup"),
  q: z.string().max(120).default(""),
});

const importSchema = z.object({
  kind: z.enum(["topup", "gift_card", "steam_gift"]),
  categoryId: z.string().min(1).max(180),
  displayName: z.string().min(1).max(180).optional(),
});

async function requireAdmin() {
  const cookieStore = await cookies();
  return verifyAdminSession(cookieStore.get(getAdminSessionCookieName())?.value);
}

export async function GET(request: Request) {
  const session = await requireAdmin();

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
    const items = await searchFazerCardsCatalog(parsed.data.kind, parsed.data.q);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("FazerCards catalog search failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "FazerCards catalog could not be searched." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireAdmin();

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
