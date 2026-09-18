import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { getAdminApiSession } from "@/lib/auth/admin-api";
import { dashboardPermissions } from "@/lib/auth/permissions";
import { createStaffAccount, getStaffAccounts } from "@/lib/staff";

const staffCreateSchema = z.object({
  email: z.email().max(160),
  displayName: z.string().max(120).optional(),
  password: z.string().min(8).max(120),
  role: z.enum(["support", "operations", "finance", "custom"]),
  permissions: z.array(z.enum(dashboardPermissions)).min(1),
  active: z.boolean().default(true),
});

export async function GET() {
  const session = await getAdminApiSession("staff");

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const staff = await getStaffAccounts();
    return NextResponse.json({ staff });
  } catch (error) {
    console.error("Staff accounts load failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Staff accounts could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getAdminApiSession("staff");

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const payload = staffCreateSchema.parse(await request.json());
    const staffId = await createStaffAccount(payload);

    return NextResponse.json({ staffId }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Please check the staff account fields." }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Staff account could not be created.";
    console.error("Staff account creation failed", { message });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
