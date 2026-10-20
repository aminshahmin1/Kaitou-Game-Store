import { timingSafeEqual } from "node:crypto";
import { syncSteamCatalogue, verifyPendingSteamGames } from "@/lib/steam-library";
export const maxDuration = 60;
export async function POST(request: Request) {
  const secret = process.env.BALANCE_MONITOR_SECRET, actual = Buffer.from(request.headers.get("authorization") ?? ""), expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual,expected)) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const started = Date.now();
  try {
    const catalog = await syncSteamCatalogue();
    const remaining = Math.min(25000, 55000 - (Date.now() - started));
    const metadata = catalog.remaining || remaining < 9000 ? { checked: 0, verified: 0 } : await verifyPendingSteamGames(24, remaining);
    return Response.json({ catalog, metadata });
  }
  catch (error) { console.error("Steam catalogue sync failed", { message: error instanceof Error ? error.message : "Unknown failure", cause: error instanceof Error ? error.cause : undefined }); return Response.json({ error: "Steam catalogue sync needs attention. Check supplier access and try again later." }, { status: 503 }); }
}
