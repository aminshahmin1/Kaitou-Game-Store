import Image from "next/image";
import Link from "next/link";
import { Moon, Search, ShieldCheck } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-cyan-300/15 bg-[#030817]/86 backdrop-blur-xl">
      <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/brand/logo-current.png"
            alt="Kaitou Game Store"
            width={54}
            height={54}
            className="h-12 w-12 rounded-full border border-cyan-300/50 object-cover shadow-[0_0_22px_rgba(0,213,255,0.34)]"
            priority
          />
          <div>
            <p className="font-display text-2xl font-bold uppercase leading-none tracking-normal">
              Kaitou
            </p>
            <p className="text-xs font-semibold uppercase text-cyan-200/80">Game Store</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-200 md:flex">
          <Link href="/#products">Products</Link>
          <Link href="/order-status">Order status</Link>
          <Link href="/about">About</Link>
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Search products"
            className="grid h-10 w-10 place-items-center rounded-md border border-cyan-300/20 bg-white/5 text-cyan-100"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Toggle dark mode"
            className="grid h-10 w-10 place-items-center rounded-md border border-cyan-300/20 bg-white/5 text-cyan-100"
          >
            <Moon className="h-4 w-4" />
          </button>
          <div className="hidden items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-bold text-cyan-100 sm:flex">
            <ShieldCheck className="h-4 w-4" />
            MYR Secure Checkout
          </div>
        </div>
      </div>
    </header>
  );
}
