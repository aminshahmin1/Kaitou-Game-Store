import Link from "next/link";
import { ChevronDown, Mail } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { faqs } from "@/lib/faqs";
export const metadata = { title: "FAQs | Kaitou Game Store" };
export default function FAQPage() {
  return <div className="trust-surface min-h-screen"><SiteHeader /><main className="mx-auto max-w-4xl px-5 py-12"><h1 className="font-display text-4xl font-bold">Frequently asked questions</h1><p className="mt-3 text-slate-600">Before you pay, while you wait, or when something needs a closer look.</p><div className="mt-8 divide-y divide-slate-200 border-y border-slate-200">{faqs.map((faq) => <details key={faq.question} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-5 font-semibold text-slate-950"><span>{faq.question}</span><ChevronDown className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" /></summary><p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">{faq.answer}</p></details>)}</div><Link href="/support" className="mt-8 inline-flex items-center gap-2 font-semibold text-sky-800"><Mail className="h-5 w-5" />Need help with your order?</Link></main><SiteFooter /></div>;
}
