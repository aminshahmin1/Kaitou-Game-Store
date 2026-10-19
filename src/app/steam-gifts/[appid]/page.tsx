import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CheckoutForm } from "@/components/checkout-form";
import { prepareSteamProduct } from "@/lib/steam-library";
import { steamBrowseLimited } from "@/lib/steam-browse-guard";
import { toCheckoutProduct } from "@/lib/checkout-product";
import { formatMyr } from "@/lib/catalog";
export const metadata = { title: "Steam gift | Kaitou Game Store" };
export default async function SteamGamePage({ params }: { params: Promise<{ appid: string }> }) {
  await connection(); const { appid } = await params;
  if (!/^[1-9][0-9]{0,9}$/.test(appid)) notFound();
  let product: Awaited<ReturnType<typeof prepareSteamProduct>>, unavailable = false;
  const limited=await steamBrowseLimited();
  try { if (limited) { product=null; unavailable=true; } else product = await prepareSteamProduct(appid); } catch { product = null; unavailable = true; }
  if (!product && !unavailable) notFound();
  return <div className="trust-surface min-h-screen"><SiteHeader /><main className="mx-auto max-w-7xl px-5 py-10"><Link href="/steam-gifts" className="inline-flex items-center gap-2 text-sm font-semibold text-sky-800"><ArrowLeft className="h-4 w-4" />Steam Gifts Library</Link>
    {product ? <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"><section className="min-w-0">{product.imageUrl && <Image src={product.imageUrl} alt={`${product.title} game artwork`} width={460} height={215} priority unoptimized className="aspect-[460/215] w-full max-w-[460px] rounded-md object-cover" />}<h1 className="mt-6 break-words font-display text-4xl font-bold">{product.title}</h1><p className="mt-4 text-sm leading-7 text-slate-600">Delivered as a Steam gift to the account linked to your invite. Select that account&apos;s region and check the edition before paying. No Steam password is needed.</p><p className="mt-4 text-sm leading-7 text-slate-600">Already own this game or part of the selected edition? Ask support before ordering; Steam may not accept the gift.</p><Link href="/support" className="mt-5 inline-block text-sm font-semibold text-sky-800">Ask about this game</Link></section>
      <section className="min-w-0">{process.env.CHECKOUT_ENABLED === "true" && product.active && product.variations.some((v) => v.active) ? <CheckoutForm product={toCheckoutProduct(product)} purchaseAvailable={product.available} /> : <div className="border-y border-slate-200 py-5"><h2 className="text-xl font-bold">Editions and regions</h2><ul className="mt-4 divide-y divide-slate-200">{product.variations.filter((v) => v.active).map((v) => <li key={v.id} className="flex min-w-0 justify-between gap-4 py-4 text-sm"><span className="min-w-0 break-words">{v.title}{!v.available && <span className="mt-1 block text-xs text-slate-600">Out of stock</span>}</span><strong className="shrink-0">{formatMyr(v.priceMyr)}</strong></li>)}</ul><p role="status" className="mt-5 text-sm text-slate-600">{product.variations.length ? "Checkout is currently unavailable for this game. Please check back shortly." : "No giftable editions are currently available. Please check back shortly."}</p></div>}</section>
    </div> : <div role="status" className="mt-8 border-y border-slate-200 py-12 text-slate-600">We could not check this game&apos;s editions and prices. Please try again shortly.</div>}
  </main><SiteFooter /></div>;
}
