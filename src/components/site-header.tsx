"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, Search, ShieldCheck, SunMoon, X } from "lucide-react";

export function SiteHeader() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    try { document.documentElement.dataset.theme = localStorage.getItem("kaitou-theme") === "light" ? "light" : "dark"; } catch { /* Storage may be unavailable. */ }
  }, []);
  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("kaitou-theme", next); } catch { /* The current page still updates. */ }
  }
  return (
    <header data-dark-surface className="sticky top-0 z-30 border-b border-cyan-300/15 bg-[#030817]/86 text-white backdrop-blur-xl">
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

        <nav className="hidden items-center gap-4 text-sm font-semibold text-slate-200 lg:flex xl:gap-6">
          <Link href="/#products">Products</Link>
          <Link href="/steam-gifts">Steam Gifts Library</Link>
          <Link href="/order-status">Order status</Link>
          <Link href="/leaderboard">Rankings</Link>
          <Link href="/about">About</Link>
          <Link href="/support">Help</Link>
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Search products"
            title="Search products"
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((open) => !open)}
            className="grid h-10 w-10 place-items-center rounded-md border border-cyan-300/20 bg-white/5 text-cyan-100"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Change color theme"
            title="Change color theme"
            onClick={toggleTheme}
            className="grid h-10 w-10 place-items-center rounded-md border border-cyan-300/20 bg-white/5 text-cyan-100"
          >
            <SunMoon className="h-4 w-4" />
          </button>
          <button type="button" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen}
            title="Menu" onClick={() => setMenuOpen((open) => !open)}
            className="grid h-10 w-10 place-items-center rounded-md border border-cyan-300/20 text-cyan-100 lg:hidden">
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          <div className="hidden items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-bold text-cyan-100 2xl:flex">
            <ShieldCheck className="h-4 w-4" />
            MYR Secure Checkout
          </div>
        </div>
      </div>
      {searchOpen && <form action="/#products" className="mx-auto flex max-w-7xl gap-2 px-5 pb-4">
        <label className="sr-only" htmlFor="store-search">Search games and top-ups</label>
        <input id="store-search" name="q" maxLength={100} autoFocus placeholder="Search games and top-ups" className="min-w-0 flex-1 rounded-md bg-white px-3 py-2 text-slate-950" />
        <button type="submit" aria-label="Search" title="Search" className="grid h-11 w-11 place-items-center rounded-md bg-cyan-300 text-slate-950"><Search className="h-5 w-5" /></button>
      </form>}
      {menuOpen && <nav className="grid gap-1 border-t border-cyan-300/15 px-5 py-3 text-sm font-semibold lg:hidden">
        <Link className="py-3" href="/#products" onClick={() => setMenuOpen(false)}>Products</Link>
        <Link className="py-3" href="/steam-gifts" onClick={() => setMenuOpen(false)}>Steam Gifts Library</Link>
        <Link className="py-3" href="/order-status" onClick={() => setMenuOpen(false)}>Order status</Link>
        <Link className="py-3" href="/leaderboard" onClick={() => setMenuOpen(false)}>Rankings</Link>
        <Link className="py-3" href="/about" onClick={() => setMenuOpen(false)}>About</Link>
        <Link className="py-3" href="/faq" onClick={() => setMenuOpen(false)}>FAQs</Link>
        <Link className="py-3" href="/support" onClick={() => setMenuOpen(false)}>Email support</Link>
      </nav>}
    </header>
  );
}
