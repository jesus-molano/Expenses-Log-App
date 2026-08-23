export function mergeLatestById<T extends { id: string }>(
  base: T[],
  incoming: T[],
  deletedIds: string[] = [],
): T[] {
  const deleted = new Set(deletedIds);
  const map = new Map<string, T>();

  for (const item of base) {
    if (!deleted.has(item.id)) map.set(item.id, item);
  }

  for (const item of incoming) {
    if (deleted.has(item.id)) continue;
    const existing = map.get(item.id);
    map.set(item.id, latestUpdated(existing, item));
  }

  return Array.from(map.values());
}

export function latestUpdated<T>(base: T | undefined, incoming: T): T {
  if (!base) return incoming;
  const baseUpdatedAt = updatedAtOf(base);
  const incomingUpdatedAt = updatedAtOf(incoming);
  if (!baseUpdatedAt || !incomingUpdatedAt) return incoming;
  return incomingUpdatedAt >= baseUpdatedAt ? incoming : base;
}

function updatedAtOf(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const updatedAt = (value as { updatedAt?: unknown }).updatedAt;
  return typeof updatedAt === "string" ? updatedAt : null;
}
