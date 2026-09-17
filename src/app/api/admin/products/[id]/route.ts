import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminSessionCookieName, verifyAdminSession } from "@/lib/auth/admin-session";
import { deleteAdminProduct, updateAdminProductStatus } from "@/lib/products";

const statusSchema = z.object({
  active: z.boolean().optional(),
  available: z.boolean().optional(),
});

async function requireAdmin() {
  const cookieStore = await cookies();
  return verifyAdminSession(cookieStore.get(getAdminSessionCookieName())?.value);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = statusSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Please check the product status fields." }, { status: 400 });
  }

  try {
    await updateAdminProductStatus(id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Product status could not be updated.";
    console.error("Admin product status update failed", {
      message,
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;

  try {
    await deleteAdminProduct(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin product delete failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Product could not be deleted." }, { status: 500 });
  }
}
