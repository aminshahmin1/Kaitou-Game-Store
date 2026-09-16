import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getAdminSessionCookieName, verifyAdminSession } from "@/lib/auth/admin-session";
import { createAdminProduct, getAdminProducts } from "@/lib/products";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = verifyAdminSession(cookieStore.get(getAdminSessionCookieName())?.value);

  return session;
}

export async function GET() {
  const session = await requireAdmin();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const products = await getAdminProducts();
    return NextResponse.json({ products });
  } catch (error) {
    console.error("Admin products load failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Products could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireAdmin();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const productId = await createAdminProduct(payload);

    return NextResponse.json({ productId }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Please check the product fields." }, { status: 400 });
    }

    console.error("Admin product creation failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Product could not be created." }, { status: 500 });
  }
}
