export function malaysiaDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((value) => value.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function revenueQuickRange(kind: "today" | "week" | "month", now = new Date()) {
  const to = malaysiaDate(now);
  let from = to;
  if (kind === "month") {
    from = `${to.slice(0, 7)}-01`;
  } else if (kind === "week") {
    // Use UTC only for arithmetic on the already-converted Malaysian calendar date.
    const start = new Date(`${to}T00:00:00Z`);
    const offset = (start.getUTCDay() + 6) % 7;
    start.setUTCDate(start.getUTCDate() - offset);
    from = start.toISOString().slice(0, 10);
  }
  return { from, to };
}
