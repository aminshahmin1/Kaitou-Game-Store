import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { SteamLibraryEntry } from "@/lib/steam-library";
export function SteamGameTile({ game, headingLevel = 2 }: { game: SteamLibraryEntry; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return <Link href={`/steam-gifts/${game.appid}`} prefetch={false} className="steam-game-link flex min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
    <Image src={game.imageUrl} alt={`${game.name} game artwork`} width={460} height={215} unoptimized className="aspect-[460/215] w-full object-cover" />
    <div className="flex flex-1 flex-col justify-between gap-3 p-3 sm:p-4"><Heading className="break-words text-sm font-bold text-slate-950 sm:text-base">{game.name}</Heading>
      <span className="inline-flex items-center gap-2 text-xs font-semibold text-sky-800 sm:text-sm">Choose edition<ArrowRight className="h-4 w-4 shrink-0" /></span>
    </div>
  </Link>;
}
