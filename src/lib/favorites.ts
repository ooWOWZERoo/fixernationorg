import { db } from "@/lib/db";
import type { FavoriteType } from "@/lib/favorites-view";

// Ids of the member's favorited items, most recently starred first.
export async function getFavoriteIds(userId: string, type: FavoriteType): Promise<string[]> {
  if (type === "blog") {
    const rows = await db.blogFavorite.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { blogPostId: true },
    });
    return rows.map((r) => r.blogPostId);
  }
  const rows = await db.morningBoostFavorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { morningBoostId: true },
  });
  return rows.map((r) => r.morningBoostId);
}
