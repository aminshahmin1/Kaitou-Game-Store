import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminApiSession } from "@/lib/auth/admin-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ rate: z.number().finite().positive().max(10000)
  .refine((value) => Math.abs(value * 1e6 - Math.round(value * 1e6)) < 0.00001) }).strict();

export async function POST(request: Request) {
  const session = await getAdminApiSession("settings");
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (session.role !== "owner") return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Enter a rate greater than 0, up to 6 decimal places." }, { status: 400 });
  try {
    const db = createSupabaseAdminClient();
    if (!db) throw new Error("Database unavailable");
    const { data, error } = await db.rpc("set_supplier_exchange_rate", { p_rate: input.data.rate });
    if (error) throw error;
    return NextResponse.json({ rate: Number(data.rate) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Exchange rate could not be saved. Please try again." }, { status: 503 });
  }
}
