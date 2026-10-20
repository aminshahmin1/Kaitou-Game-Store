import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { EmailSupportForm } from "@/components/email-support-form";
export const metadata = { title: "Email support | Kaitou Game Store" };
export default async function SupportPage({ searchParams }: { searchParams: Promise<{ order?: string | string[] }> }) {
  const params = await searchParams;
  const order = typeof params.order === "string" ? params.order.slice(0, 80) : "";
  return <div className="trust-surface min-h-screen"><SiteHeader /><main className="mx-auto grid max-w-5xl gap-10 px-5 py-12 lg:grid-cols-2">
    <section><h1 className="font-display text-4xl font-bold">Let&apos;s sort it out.</h1>
      <p className="mt-4 leading-7 text-slate-600">Missing a top-up, unsure about a payment, or need help with a Steam gift? Send us your order number and a short description. We can check what happened without asking you to pay again.</p>
      <h2 className="mt-8 text-lg font-bold">Have these ready</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600"><li>Your Kaitou order number</li><li>The email or phone number used at checkout</li><li>Your payment receipt, if payment is the issue</li></ul>
      <p className="mt-5 text-sm leading-6 text-slate-600">Send your message here without opening an email app. We will reply by email as soon as we can. Please do not send passwords, OTPs or recovery codes.</p>
      <div className="mt-7 flex flex-wrap gap-5 font-semibold text-sky-800"><Link href="/order-status">Check order status</Link><Link href="/faq">Read the FAQs</Link></div>
    </section><section aria-label="Contact support" className="min-w-0 border-t border-slate-200 pt-7 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0"><EmailSupportForm initialOrder={order} /></section>
  </main><SiteFooter /></div>;
}
