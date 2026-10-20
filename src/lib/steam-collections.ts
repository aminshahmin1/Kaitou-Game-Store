export const steamCollections = [
  { id: "new-noteworthy", label: "New & Noteworthy", source: "Current chart / 2026 releases" },
  { id: "action", label: "Action & Open World", source: "AAA action and open world" },
  { id: "rpg", label: "RPG & Soulslike", source: "RPG and soulslike" },
  { id: "survival", label: "Survival & Building", source: "Survival sandbox and building" },
  { id: "strategy", label: "Strategy & Simulation", source: "Strategy simulation and management" },
  { id: "multiplayer", label: "Co-op & Shooters", source: "Competitive co-op and shooters" },
  { id: "indie", label: "Indie Favourites", source: "Indie hits and roguelikes" },
  { id: "horror", label: "Horror & Adventure", source: "Horror narrative and adventure" },
  { id: "sports", label: "Sports, Racing & Fighting", source: "Sports racing and fighting" },
] as const;
export function steamCollection(input?: string) { return steamCollections.find((item) => item.id === input); }
// Editorial picks, not a sales chart; availability is still checked when opened.
export const featuredSteamIds = [1091500, 1245620, 413150, 1086940, 1174180, 1623730, 1145360, 892970, 275850];
