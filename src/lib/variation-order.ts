export function moveVariation<T extends { localId: string }>(items: T[], sourceId: string, targetId: string): T[] {
  const from = items.findIndex((item) => item.localId === sourceId);
  const to = items.findIndex((item) => item.localId === targetId);
  if (from < 0 || to < 0 || from === to) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
