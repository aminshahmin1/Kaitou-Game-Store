import Image from "next/image";
import type { CSSProperties } from "react";
import { getGameCurrency } from "@/lib/game-currency";

export function CurrencyRain({ game }: { game: string }) {
  const currency = getGameCurrency(game);
  if (!currency.image) return null;
  return <span aria-hidden="true" className="currency-rain" data-currency-rain={currency.unit}>
    {Array.from({ length: 16 }, (_, index) => <span key={index} className="currency-drop" style={{
      "--drop-left": `${3 + (index * 29) % 94}%`, "--drop-delay": `${-index * 0.37}s`,
      "--drop-size": `${14 + (index % 4) * 5}px`, "--drop-drift": `${index % 2 ? 24 : -20}px`,
      "--drop-duration": `${2.5 + (index % 5) * 0.38}s`, "--drop-turn": `${index % 2 ? 145 : -125}deg`,
    } as CSSProperties}><Image src={currency.image!} alt="" width={32} height={32} className="h-full w-full object-contain" /></span>)}
  </span>;
}
