import Image from "next/image";
import type { CSSProperties } from "react";
import { getGameCurrency } from "@/lib/game-currency";

export function CurrencyRain({ game }: { game: string }) {
  const currency = getGameCurrency(game);
  if (!currency.image) return null;
  return <span aria-hidden="true" className="currency-rain" data-currency-rain={currency.unit}>
    {Array.from({ length: 9 }, (_, index) => <span key={index} className="currency-drop" style={{
      "--drop-left": `${6 + (index * 13) % 88}%`, "--drop-delay": `${-index * 0.71}s`,
      "--drop-duration": `${4.8 + (index % 3) * 0.6}s`, "--drop-turn": `${index % 2 ? 28 : -24}deg`,
    } as CSSProperties}><Image src={currency.image!} alt="" width={22} height={22} className="h-full w-full object-contain" /></span>)}
  </span>;
}
