export function estimateCostMyr(costUsd: number, rate: number): number {
  if (!Number.isFinite(costUsd) || costUsd < 0 || !Number.isFinite(rate) || rate < 0) {
    throw new Error("Invalid supplier cost or funding rate.");
  }
  return Math.round((costUsd * rate + Number.EPSILON) * 100) / 100;
}
