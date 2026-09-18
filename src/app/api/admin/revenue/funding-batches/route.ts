import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { getAdminApiSession } from "@/lib/auth/admin-api";
import { createFundingBatch } from "@/lib/revenue";

const fundingBatchSchema = z.object({
  topupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  myrSpent: z.coerce.number().min(0),
  usdCredited: z.coerce.number().positive(),
  feesMyr: z.coerce.number().min(0).default(0),
  reference: z.string().max(160).optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const session = await getAdminApiSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const payload = fundingBatchSchema.parse(await request.json());
    const fundingBatchId = await createFundingBatch(payload);

    return NextResponse.json({ fundingBatchId }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Please check the funding batch fields." }, { status: 400 });
    }

    console.error("Funding batch creation failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Funding batch could not be saved." }, { status: 500 });
  }
}
