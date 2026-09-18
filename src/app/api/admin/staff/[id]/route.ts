import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { getAdminApiSession } from "@/lib/auth/admin-api";
import { dashboardPermissions } from "@/lib/auth/permissions";
import { updateStaffAccount } from "@/lib/staff";

const staffUpdateSchema = z.object({
  email: z.email().max(160).optional(),
  displayName: z.string().max(120).optional(),
  password: z.string().min(8).max(120).optional().or(z.literal("")),
  role: z.enum(["support", "operations", "finance", "custom"]).optional(),
  permissions: z.array(z.enum(dashboardPermissions)).min(1).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminApiSession("staff");

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const payload = staffUpdateSchema.parse(await request.json());
    await updateStaffAccount(id, {
      ...payload,
      password: payload.password || undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Please check the staff account fields." }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Staff account could not be updated.";
    console.error("Staff account update failed", { message });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
