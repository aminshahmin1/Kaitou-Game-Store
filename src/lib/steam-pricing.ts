export function steamSellingPrice(costUsd: number, rate: number) {
  if (!Number.isFinite(costUsd) || costUsd <= 0 || !Number.isFinite(rate) || rate <= 0) throw new Error("Invalid Steam price.");
  const costCents = Math.round((costUsd * rate + Number.EPSILON) * 100);
  const ceilings = [1000, 2000, 5000, 8000, 10000, 15000, 20000, 25000, 30000];
  const tier = ceilings.findIndex((ceiling) => costCents <= ceiling);
  const markupMyr = tier < 0 ? 10 : tier + 1;
  return { costMyr: costCents / 100, markupMyr, priceMyr: (costCents + markupMyr * 100) / 100 };
}

export function normalizeSteamInvite(value: string) {
  const raw = value.trim();
  const url = new URL(raw.startsWith("s.team/") ? `https://${raw}` : raw);
  if (url.protocol !== "https:" || url.hostname !== "s.team" || url.port || url.username || url.password
    || !/^\/p\/[a-z0-9-]+\/[a-z0-9-]+\/?$/i.test(url.pathname) || url.search || url.hash) throw new Error("Use your Steam friend invite link, starting with https://s.team/p/.");
  return `https://s.team${url.pathname.replace(/\/$/, "")}`;
}
