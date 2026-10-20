"use client";
import { useRef, useState } from "react";
import { LoaderCircle, Paperclip, Send, X } from "lucide-react";
const field = "min-w-0 rounded-md border border-slate-300 bg-white px-3 py-3 text-slate-950";
export function EmailSupportForm({ initialOrder = "" }: { initialOrder?: string }) {
  const [files, setFiles] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const sending = useRef(false);
  return <form className="grid min-w-0 gap-5" onSubmit={async (event) => {
    event.preventDefault();
    if (sending.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    files.forEach((file) => data.append("attachments", file));
    sending.current = true; setPending(true); setError(""); setReference("");
    try {
      const response = await fetch("/api/support", { method: "POST", body: data });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your message could not be sent. Please try again later.");
      setReference(result.reference); form.reset(); setFiles([]);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Your message could not be sent. Please try again later.");
    } finally { sending.current = false; setPending(false); }
  }}>
    <fieldset disabled={pending} className="grid min-w-0 gap-5 disabled:opacity-70">
      <label className="grid gap-2 text-sm font-semibold">Name<input name="name" autoComplete="name" required maxLength={100} className={field} /></label>
      <label className="grid gap-2 text-sm font-semibold">Email address<input name="email" type="email" autoComplete="email" required maxLength={254} className={field} /></label>
      <label className="grid gap-2 text-sm font-semibold">Phone number<input name="phone" type="tel" autoComplete="tel" required maxLength={30} placeholder="0123456789" pattern={"\\+?[0-9 \\(\\)\\-]{7,30}"} className={field} /></label>
      <label className="grid gap-2 text-sm font-semibold">Order number (optional)<input name="order" defaultValue={initialOrder} maxLength={80} placeholder="KGS-..." className={field} /></label>
      <label className="grid gap-2 text-sm font-semibold">What do you need help with?<select name="topic" className={field}><option>Delivery or order status</option><option>Payment question</option><option>Incorrect account details</option><option>Steam gift</option><option>Something else</option></select></label>
      <label className="grid gap-2 text-sm font-semibold">Your message<textarea name="message" required minLength={10} maxLength={4000} rows={5} placeholder="Tell us what happened and what you can see in Order Status." className={field} /></label>
      <div className="hidden" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <div className="grid min-w-0 gap-2 text-sm">
        <label htmlFor="support-files" className="flex items-center gap-2 font-semibold"><Paperclip className="h-4 w-4" />Attachments (optional)</label>
        <p id="support-files-help" className="text-slate-600">Up to 3 files, 2 MB combined. JPG, PNG, WebP or PDF. Hide passwords, card numbers and other sensitive details.</p>
        <input id="support-files" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" aria-describedby="support-files-help" className="block w-full min-w-0 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-semibold file:text-slate-950" onChange={(event) => {
          const selected = [...files, ...Array.from(event.target.files ?? [])];
          event.target.value = "";
          if (selected.length > 3 || selected.reduce((sum, file) => sum + file.size, 0) > 2 * 1024 * 1024) { setError("Attach up to 3 files, with a combined size of 2 MB or less."); return; }
          if (selected.some((file) => !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type))) { setError("Only JPG, PNG, WebP and PDF files are accepted."); return; }
          setFiles(selected); setError(""); setReference("");
        }} />
        {files.map((file, index) => <div key={`${file.name}-${index}`} className="flex min-w-0 items-center justify-between gap-2 border-b border-slate-200 py-2"><span className="min-w-0 break-all">{file.name} <span className="text-slate-600">({Math.ceil(file.size / 1024)} KB)</span></span><button type="button" aria-label={`Remove ${file.name}`} title="Remove attachment" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md" onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}><X className="h-4 w-4" /></button></div>)}
      </div>
      <p className="text-sm leading-6 text-slate-600">Your message and contact details go directly to Kaitou support. We will reply to your email address.</p>
      <button type="submit" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-sky-800 px-5 py-3 font-semibold text-white">{pending ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}{pending ? "Sending..." : "Send message"}</button>
    </fieldset>
    {error && <p role="alert" className="break-words text-sm font-semibold text-red-700">{error}</p>}
    {reference && <p role="status" className="break-words text-sm font-semibold text-emerald-700">Your message has been sent to support. Reference: {reference}. Keep this reference; we will reply by email.</p>}
  </form>;
}
