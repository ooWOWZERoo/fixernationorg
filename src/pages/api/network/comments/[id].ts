import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized." });

  const commentId = req.query.id as string;
  const comment = await db.comment.findUnique({ where: { id: commentId } });
  if (!comment || comment.deletedAt) return res.status(404).json({ error: "Comment not found." });

  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole);
  const isAuthor = comment.authorId === session.user.id;
  if (!isAdmin && !isAuthor) return res.status(403).json({ error: "Forbidden." });

  await db.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
  return res.status(200).json({ ok: true });
}
