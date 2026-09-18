import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { updateAdminOrder } from "@/lib/admin-orders";
import { getAdminApiSession } from "@/lib/auth/admin-api";

const orderUpdateSchema = z.object({
  status: z.enum(["processing", "completed", "review", "failed", "refunded"]).optional(),
  supportNotes: z.string().max(2000).nullable().optional(),
  failureReason: z.string().max(1000).nullable().optional(),
  refundReference: z.string().max(160).nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminApiSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const payload = orderUpdateSchema.parse(await request.json());
    await updateAdminOrder(id, payload);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Please check the order fields." }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Order could not be updated.";
    console.error("Review order update failed", { message });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
