import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;

  // Public groups always included. If signed in, also include user's private groups.
  let groupIds: string[] | undefined;
  if (session) {
    const memberships = await db.groupMember.findMany({
      where: { userId: session.user.id },
      select: { groupId: true },
    });
    const privateGroupIds = memberships.map((m) => m.groupId);

    const publicGroups = await db.socialGroup.findMany({
      where: { visibility: "PUBLIC" },
      select: { id: true },
    });
    const publicGroupIds = publicGroups.map((g) => g.id);

    groupIds = [...new Set([...publicGroupIds, ...privateGroupIds])];
  }

  const posts = await db.post.findMany({
    where: {
      deletedAt: null,
      ...(groupIds
        ? { groupId: { in: groupIds } }
        : { group: { visibility: "PUBLIC" } }),
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      author: { select: { id: true, name: true, image: true } },
      group: { select: { id: true, name: true, slug: true } },
      _count: { select: { comments: true, reactions: true } },
    },
  });

  const likedPostIds = session
    ? new Set(
        (
          await db.reaction.findMany({
            where: {
              userId: session.user.id,
              postId: { in: posts.map((p) => p.id) },
            },
            select: { postId: true },
          })
        ).map((r) => r.postId as string)
      )
    : new Set<string>();

  const items = posts.map((p) => ({
    ...p,
    likedByMe: likedPostIds.has(p.id),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    deletedAt: p.deletedAt?.toISOString() ?? null,
  }));

  const nextCursor =
    posts.length === 20 ? posts[posts.length - 1].createdAt.toISOString() : null;

  return res.status(200).json({ items, nextCursor });
}
