import Link from "next/link";
export function SiteFooter() {
  return <footer className="trust-surface border-t border-slate-200"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 px-5 py-8 text-sm sm:flex-row">
    <div><p className="font-bold text-slate-950">Kaitou Game Store</p><a className="mt-2 inline-block text-sky-800" href="mailto:amin@kaitou.shop">amin@kaitou.shop</a></div>
    <nav aria-label="Helpful links" className="flex flex-wrap items-start gap-x-6 gap-y-3 text-slate-700"><Link href="/faq">FAQs</Link><Link href="/support">Email support</Link><Link href="/order-status">Track an order</Link><Link href="/about">About Kaitou</Link></nav>
  </div></footer>;
}
