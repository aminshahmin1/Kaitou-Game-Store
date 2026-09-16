import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));

  return NextResponse.json({
    received: true,
    message: "FazerCards webhook received.",
    providerReference: payload.providerReference ?? null,
  });
}
