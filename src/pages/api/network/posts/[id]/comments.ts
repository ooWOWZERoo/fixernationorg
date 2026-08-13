import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const createBody = z.object({ body: z.string().min(1).max(2000) });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const postId = req.query.id as string;
  const post = await db.post.findUnique({ where: { id: postId } });
  if (!post || post.deletedAt) return res.status(404).json({ error: "Post not found." });

  const session = await getServerSession(req, res, authOptions);

  if (req.method === "GET") {
    const comments = await db.comment.findMany({
      where: { postId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: {
        author: { select: { id: true, name: true, image: true } },
        _count: { select: { reactions: true } },
      },
    });

    const likedIds = session
      ? new Set(
          (
            await db.reaction.findMany({
              where: {
                userId: session.user.id,
                commentId: { in: comments.map((c) => c.id) },
              },
              select: { commentId: true },
            })
          ).map((r) => r.commentId as string)
        )
      : new Set<string>();

    return res.status(200).json(
      comments.map((c) => ({
        ...c,
        likedByMe: likedIds.has(c.id),
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        deletedAt: c.deletedAt?.toISOString() ?? null,
      }))
    );
  }

  if (req.method === "POST") {
    if (!session) return res.status(401).json({ error: "Sign in to comment." });

    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Comment body is required." });

    const comment = await db.comment.create({
      data: { postId, authorId: session.user.id, body: parsed.data.body },
      include: {
        author: { select: { id: true, name: true, image: true } },
        _count: { select: { reactions: true } },
      },
    });

    return res.status(201).json({
      ...comment,
      likedByMe: false,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      deletedAt: null,
    });
  }

  return res.status(405).end();
}
