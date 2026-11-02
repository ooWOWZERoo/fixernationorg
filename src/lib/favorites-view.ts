// Client-safe favorites helpers (no database import).
export type FavoriteType = "blog" | "boost";

// Applies the favorites view: keeps only starred items, in starred order.
export function orderByFavorites<T extends { id: string }>(items: T[], favoriteIds: string[]): T[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  return favoriteIds.map((id) => byId.get(id)).filter((i): i is T => i !== undefined);
}
