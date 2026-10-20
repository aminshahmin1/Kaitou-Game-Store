export type GameCurrency = { name: string; unit: string; image: string | null };
export function getGameCurrency(game: string): GameCurrency {
  if (/genshin/i.test(game)) return { name: "Genshin Impact", unit: "Genesis Crystals", image: "/currencies/genesis-crystal.png" };
  if (/mobile legends|mlbb/i.test(game)) return { name: "Mobile Legends", unit: "Diamonds", image: "/currencies/mlbb-diamond.png" };
  if (/free fire/i.test(game)) return { name: "Free Fire", unit: "Diamonds", image: "/currencies/free-fire-diamond.png" };
  if (/pubg/i.test(game)) return { name: "PUBG Mobile", unit: "UC", image: "/currencies/pubg-uc.png" };
  if (/wuthering/i.test(game)) return { name: "Wuthering Waves", unit: "Lunite", image: "/currencies/lunite.png" };
  return { name: game.split(" | ")[0].replace(/\s*\([^)]*\)/g, "").trim() || "Other games", unit: "Currency", image: null };
}
