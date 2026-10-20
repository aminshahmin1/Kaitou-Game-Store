"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Gem } from "lucide-react";
import { getGameCurrency } from "@/lib/game-currency";

export function RankingGameTabs({ groups, selected }: { groups: string[]; selected?: string }) {
  const strip = useRef<HTMLElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  useEffect(() => {
    const element = strip.current;
    if (!element) return;
    const update = () => setEdges({ left: element.scrollLeft > 2, right: element.scrollLeft + element.clientWidth < element.scrollWidth - 2 });
    const active = element.querySelector<HTMLElement>('[aria-current="page"]');
    if (active) element.scrollLeft = Math.max(0, active.offsetLeft - element.offsetLeft - 8);
    update();
    const observer = new ResizeObserver(update); observer.observe(element);
    // Web fonts can resize the links without changing the scroll container width.
    for (const child of element.children) observer.observe(child);
    element.addEventListener("scroll", update, { passive: true });
    return () => { observer.disconnect(); element.removeEventListener("scroll", update); };
  }, [selected]);
  function move(direction: number) {
    strip.current?.scrollBy({ left: direction * Math.max(200, strip.current.clientWidth * 0.75), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  return <div className="ranking-tabs-row">
    <button type="button" className="ranking-scroll-button" aria-label="Previous games" title="Previous games" disabled={!edges.left} onClick={() => move(-1)}><ChevronLeft className="h-5 w-5" /></button>
    <nav ref={strip} aria-label="Game rankings" className="ranking-game-strip">
      {groups.map((group) => {
        const currency = getGameCurrency(group);
        return <Link key={group} href={`/leaderboard?game=${encodeURIComponent(group)}`} prefetch={false}
          aria-current={group === selected ? "page" : undefined} aria-label={`${currency.name} rankings: ${group}`} title={group} className="ranking-game-tab">
          {currency.image ? <Image src={currency.image} alt="" width={32} height={32} className="h-8 w-8 shrink-0 object-contain" /> : <Gem className="h-7 w-7 shrink-0" />}
          <span>{currency.name}</span>
        </Link>;
      })}
    </nav>
    <button type="button" className="ranking-scroll-button" aria-label="Next games" title="Next games" disabled={!edges.right} onClick={() => move(1)}><ChevronRight className="h-5 w-5" /></button>
  </div>;
}
