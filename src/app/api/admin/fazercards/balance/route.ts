import { NextResponse } from "next/server";
import { getAdminApiSession } from "@/lib/auth/admin-api";
import { getFazerCardsBalance } from "@/lib/integrations/fazercards-balance";
import { getFundingCostBasis } from "@/lib/funding-cost";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  if (!await getAdminApiSession()) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers });
  try {
    const balance = await getFazerCardsBalance();
    const basis = await getFundingCostBasis().catch(() => null);
    return NextResponse.json({ balance, basis }, { headers });
  } catch {
    return NextResponse.json({ error: "Balance sync failed. Please try again." }, { status: 503, headers });
  }
}
