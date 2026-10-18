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
    await sendAdminEmail("Kaitou | Email connection verified", "Your Kaitou Game Store email connection is working.\n\nThis message confirms that the store can submit email using the configured SMTP service. It does not create an order, process a payment or change notification settings.\n\nYou can manage your email connection at https://kaitou.shop/dashboard/integrations.\n\nKaitou Game Store\nhttps://kaitou.shop");
    return NextResponse.json({ message: "Gmail accepted the test email. Check your inbox and spam folder." });
  } catch {
    return NextResponse.json({ error: "Email could not be sent. Check the SMTP settings and Google App Password." }, { status: 502 });
  }
}
