import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { awardPoints, POINTS } from "@/lib/loyalty";

const createBody = z.object({
  body: z.string().min(1).max(5000),
  attachments: z
    .array(z.object({ type: z.literal("image"), url: z.string(), name: z.string() }))
    .max(4)
    .optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const slug = req.query.slug as string;
  const group = await db.socialGroup.findUnique({ where: { slug } });
  if (!group) return res.status(404).json({ error: "Group not found." });

  const session = await getServerSession(req, res, authOptions);

  if (req.method === "GET") {
    const isAdmin =
      session && ["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole);
    const isMember = session
      ? !!(await db.groupMember.findUnique({
          where: { groupId_userId: { groupId: group.id, userId: session.user.id } },
        }))
      : false;

    if (group.visibility === "PRIVATE" && !isMember && !isAdmin) {
      return res.status(403).json({ error: "Join this group to view posts." });
    }

    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;

    const posts = await db.post.findMany({
      where: {
        groupId: group.id,
        deletedAt: null,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 20,
      include: {
        author: { select: { id: true, name: true, image: true } },
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

  if (req.method === "POST") {
    if (!session) return res.status(401).json({ error: "Sign in to post." });

    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole);
    const isMember = !!(await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: session.user.id } },
    }));

    if (!isMember && !isAdmin) {
      return res.status(403).json({ error: "Join this group to post." });
    }

    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid post data." });

    const post = await db.post.create({
      data: {
        groupId: group.id,
        authorId: session.user.id,
        body: parsed.data.body,
        attachments: parsed.data.attachments ?? undefined,
      },
      include: {
        author: { select: { id: true, name: true, image: true } },
        _count: { select: { comments: true, reactions: true } },
      },
    });

    awardPoints(session.user.id, POINTS.POST_CREATED, "post_created", post.id).catch(() => {});

    return res.status(201).json({
      ...post,
      likedByMe: false,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      deletedAt: null,
    });
  }

  return res.status(405).end();
}
