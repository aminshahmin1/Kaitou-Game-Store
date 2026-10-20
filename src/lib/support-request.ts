import "server-only";
import { z } from "zod";

export const MAX_SUPPORT_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_SUPPORT_BODY_BYTES = MAX_SUPPORT_FILE_BYTES + 64 * 1024;
const singleLine = (max: number) => z.string().trim().min(1).max(max).refine((v) => !/[\x00-\x1f\x7f]/.test(v));
const schema = z.object({
  name: singleLine(100), email: z.email().max(254),
  phone: singleLine(30).refine((v) => /^\+?[\d ()-]+$/.test(v) && v.replace(/\D/g, "").length >= 7 && v.replace(/\D/g, "").length <= 15),
  order: z.string().trim().max(80).refine((v) => !/[\x00-\x1f\x7f]/.test(v)),
  topic: z.enum(["Delivery or order status", "Payment question", "Incorrect account details", "Steam gift", "Something else"]),
  message: z.string().trim().min(10).max(4000).refine((v) => !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v)),
});
export class SupportInputError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export async function readSupportForm(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data;")) throw new SupportInputError("Please submit the support form with valid attachments.");
  if (Number(request.headers.get("content-length")) > MAX_SUPPORT_BODY_BYTES) throw new SupportInputError("Attachments must total 2 MB or less.", 413);
  if (!request.body) throw new SupportInputError("The support form is empty.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_SUPPORT_BODY_BYTES) { await reader.cancel(); throw new SupportInputError("Attachments must total 2 MB or less.", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return await new Response(Buffer.concat(chunks), { headers: { "Content-Type": contentType } }).formData(); }
  catch { throw new SupportInputError("The support form could not be read. Please select your files again."); }
}
export async function validateSupportForm(form: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(["name", "email", "phone", "order", "topic", "message"].map((key) => [key, form.get(key) ?? ""])));
  if (!parsed.success) throw new SupportInputError("Please check your name, email, phone number and message (10-4,000 characters).");
  const files = form.getAll("attachments").filter((value) => typeof value !== "string" && value.size > 0);
  if (files.length > 3) throw new SupportInputError("Please attach no more than 3 files.");
  let total = 0;
  const attachments: { filename: string; content: Buffer; contentType: string }[] = [];
  for (const [index, file] of files.entries()) {
    if (typeof file === "string") throw new SupportInputError("Invalid attachment.");
    total += file.size;
    if (total > MAX_SUPPORT_FILE_BYTES) throw new SupportInputError("Attachments must total 2 MB or less.", 413);
    const content = Buffer.from(await file.arrayBuffer());
    const signatures = [
      { type: "image/png", ext: "png", valid: content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
      { type: "image/jpeg", ext: "jpg", valid: content[0] === 255 && content[1] === 216 && content[2] === 255 },
      { type: "image/webp", ext: "webp", valid: content.toString("ascii", 0, 4) === "RIFF" && content.toString("ascii", 8, 12) === "WEBP" },
      { type: "application/pdf", ext: "pdf", valid: content.toString("ascii", 0, 5) === "%PDF-" },
    ];
    const match = signatures.find((s) => s.type === file.type && s.valid && new RegExp(`\\.${s.ext === "jpg" ? "jpe?g" : s.ext}$`, "i").test(file.name));
    if (!match) throw new SupportInputError("Only valid JPG, PNG, WebP and PDF files are accepted.");
    attachments.push({ filename: `attachment-${index + 1}.${match.ext}`, content, contentType: match.type });
  }
  return { ...parsed.data, attachments };
}
