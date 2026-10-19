import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { createSupabaseAdminClient } from "./supabase/admin";

type Scope = "login" | "checkout" | "order-status" | "steam-library";
const limits: Record<Scope, { limit: number; seconds: number }> = {
  login: { limit: 10, seconds: 900 },
  checkout: { limit: 8, seconds: 900 },
  "order-status": { limit: 30, seconds: 60 },
  "steam-library": { limit: 30, seconds: 60 },
};

export async function guardRequest(request: Request, scope: Scope): Promise<Response | null> {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "This request must come from Kaitou Game Store." }, { status: 403 });
  }
  try {
    const secret = process.env.ADMIN_SESSION_SECRET;
    const db = createSupabaseAdminClient();
    if (!secret || !db) throw new Error("Request protection is not configured.");
    // Vercel sets this header at its trusted edge. Never use caller-supplied IPs locally.
    const candidate = process.env.VERCEL === "1" ? request.headers.get("x-vercel-forwarded-for")?.trim() : "local";
    const ip = candidate && (candidate === "local" || isIP(candidate)) ? candidate : "unknown";
    const key = createHmac("sha256", secret).update(`${scope}:${ip}`).digest("hex");
    const { data, error } = await db.rpc("consume_request_limit", {
      p_key: key, p_limit: limits[scope].limit, p_seconds: limits[scope].seconds,
    });
    if (error || !data?.[0]) throw new Error("Request protection is unavailable.");
    if (!data[0].allowed) return Response.json({ error: "Too many attempts. Please wait and try again." }, {
      status: 429, headers: { "Retry-After": String(data[0].retry_after), "Cache-Control": "no-store" },
    });
    return null;
  } catch {
    return Response.json({ error: "This service is temporarily unavailable. Please try again shortly." }, { status: 503 });
  }
}
