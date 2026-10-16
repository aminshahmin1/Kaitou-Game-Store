import { NextResponse } from "next/server";
import { getAdminApiSession } from "@/lib/auth/admin-api";
import { getEmailConfiguration, sendAdminEmail } from "@/lib/integrations/email";

export async function GET() {
  const session = await getAdminApiSession("integrations");
  if (session?.role !== "owner") return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  return NextResponse.json(getEmailConfiguration());
}

export async function POST(request: Request) {
  const session = await getAdminApiSession("integrations");
  if (session?.role !== "owner") return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  try {
    await sendAdminEmail("Kaitou SMTP test", "This is a test email from Kaitou Game Store. SMTP delivery is connected. Low-balance alerts require the balance-monitoring workflow to be enabled separately.");
    return NextResponse.json({ message: "Gmail accepted the test email. Check your inbox and spam folder." });
  } catch {
    return NextResponse.json({ error: "Email could not be sent. Check the SMTP settings and Google App Password." }, { status: 502 });
  }
}
