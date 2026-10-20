import { randomUUID } from "node:crypto";
import { getEmailConfiguration, sendStoreEmail } from "@/lib/integrations/email";
import { guardRequest } from "@/lib/request-guard";
import { readSupportForm, SupportInputError, validateSupportForm } from "@/lib/support-request";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  const blocked = await guardRequest(request, "support");
  if (blocked) return blocked;
  const respond = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  try {
    const form = await readSupportForm(request);
    if (String(form.get("website") ?? "").trim()) return respond({ error: "Please reload the page and try again." }, 400);
    const support = await validateSupportForm(form);
    const config = getEmailConfiguration();
    if (!config.configured || !config.recipient) return respond({ error: "Support sending is temporarily unavailable. Please email amin@kaitou.shop." }, 503);
    const reference = `SUP-${randomUUID().slice(0, 8).toUpperCase()}`;
    const text = `Support reference: ${reference}\nName: ${support.name}\nEmail: ${support.email}\nPhone: ${support.phone}\nOrder: ${support.order || "Not provided"}\nTopic: ${support.topic}\n\n${support.message}\n\nAttachments: ${support.attachments.length}\nCustomer-submitted attachments are untrusted. Do not open unexpected links or enable active content.`;
    await sendStoreEmail(config.recipient, `[${reference}] ${support.topic}`, text, `<${reference.toLowerCase()}@kaitou.shop>`, undefined, { replyTo: support.email, attachments: support.attachments });
    return respond({ reference });
  } catch (error) {
    if (error instanceof SupportInputError) return respond({ error: error.message }, error.status);
    // SMTP can fail after accepting a message; never automatically resend.
    return respond({ error: "We could not confirm your message was sent. Your details are still here. Please try again later or email amin@kaitou.shop." }, 503);
  }
}
