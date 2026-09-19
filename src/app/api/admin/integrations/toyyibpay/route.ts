import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminApiSession } from "@/lib/auth/admin-api";
import { checkToyyibPayCategory } from "@/lib/integrations/toyyibpay";
import { checkToyyibPayTest, createToyyibPayTest, getToyyibPayTests } from "@/lib/toyyibpay-tests";

export async function GET(request: Request) {
  const session = await getAdminApiSession("integrations");
  if (session?.role !== "owner") return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  try {
    const id = new URL(request.url).searchParams.get("test");
    if (id) return NextResponse.json({ test: await checkToyyibPayTest(id) });
    return NextResponse.json({ connection: await checkToyyibPayCategory(), tests: await getToyyibPayTests(), checkoutEnabled: process.env.CHECKOUT_ENABLED === "true" });
  } catch {
    return NextResponse.json({ error: "ToyyibPay could not be checked. Please try again." }, { status: 502 });
  }
}

const testSchema = z.object({ customerName: z.string().trim().min(2).max(80), customerEmail: z.email().max(120), whatsapp: z.string().regex(/^[+\d\s-]{8,20}$/) });

export async function POST(request: Request) {
  const session = await getAdminApiSession("integrations");
  if (session?.role !== "owner") return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  const parsed = testSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter your name, email, and phone number." }, { status: 400 });
  try {
    const test = await createToyyibPayTest(parsed.data);
    return NextResponse.json({ test }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "The test bill could not be created. Check the ToyyibPay connection before retrying." }, { status: 502 });
  }
}
