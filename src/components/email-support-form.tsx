"use client";
import { useState } from "react";
import { Mail } from "lucide-react";
export function EmailSupportForm() {
  const [opened, setOpened] = useState(false);
  return <form className="grid gap-5" onSubmit={(event) => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const order = String(data.get("order") ?? "").trim(), topic = String(data.get("topic") ?? "Order support");
    const body = `Hello Kaitou support,\n\nOrder number: ${order || "Not available"}\nTopic: ${topic}\n\n${String(data.get("message") ?? "").trim()}\n\nI can attach my payment receipt to this email.`;
    window.location.href = `mailto:amin@kaitou.shop?subject=${encodeURIComponent(`${topic}${order ? ` - ${order}` : ""}`)}&body=${encodeURIComponent(body)}`; setOpened(true);
  }}>
    <label className="grid gap-2 text-sm font-semibold">Order number (if you have one)<input name="order" maxLength={80} placeholder="KGS-..." className="min-w-0 rounded-md border border-slate-300 bg-white px-3 py-3 text-slate-950" /></label>
    <label className="grid gap-2 text-sm font-semibold">What do you need help with?<select name="topic" className="rounded-md border border-slate-300 bg-white px-3 py-3 text-slate-950"><option>Delivery or order status</option><option>Payment question</option><option>Incorrect account details</option><option>Steam gift</option><option>Something else</option></select></label>
    <label className="grid gap-2 text-sm font-semibold">Your message<textarea name="message" required minLength={10} maxLength={2000} rows={5} placeholder="Tell us what happened and what you can see in Order Status." className="min-w-0 rounded-md border border-slate-300 bg-white px-3 py-3 text-slate-950" /></label>
    <button type="submit" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-sky-800 px-5 py-3 font-semibold text-white"><Mail className="h-5 w-5" />Open email draft</button>
    <p className="text-sm leading-6 text-slate-600" role={opened ? "status" : undefined}>{opened ? "Your email app should open with a draft. Attach your receipt if needed, then send it. Nothing has been sent from this page." : "This opens a draft in your email app. You can check it and attach a receipt before sending."} If it does not open, email <a className="break-all font-semibold text-sky-800" href="mailto:amin@kaitou.shop">amin@kaitou.shop</a> directly.</p>
  </form>;
}
