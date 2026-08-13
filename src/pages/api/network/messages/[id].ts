import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Sign in to access messages." });

  const me = session.user.id;
  const conversationId = req.query.id as string;

  // Verify the current user is a participant
  const participation = await db.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: me } },
  });
  if (!participation) return res.status(403).json({ error: "Not a participant." });

  // ── GET: fetch messages ───────────────────────────────────────────────────
  if (req.method === "GET") {
    const since =
      typeof req.query.since === "string" ? new Date(req.query.since) : undefined;

    const messages = await db.directMessage.findMany({
      where: {
        conversationId,
        deletedAt: null,
        ...(since ? { createdAt: { gt: since } } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: since ? undefined : 60,
      include: { sender: { select: { id: true, name: true, image: true } } },
    });

    return res.status(200).json({
      messages: messages.map((m) => ({
        id: m.id,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
        sender: m.sender,
      })),
    });
  }

  // ── POST: send a message ──────────────────────────────────────────────────
  if (req.method === "POST") {
    const parsed = z
      .object({ body: z.string().min(1).max(5000) })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Message body required." });

    const message = await db.directMessage.create({
      data: { conversationId, senderId: me, body: parsed.data.body },
      include: { sender: { select: { id: true, name: true, image: true } } },
    });

    // Bump conversation updatedAt so the list sorts correctly
    await db.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Mark as read for the sender immediately
    await db.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: me } },
      data: { lastReadAt: new Date() },
    });

    return res.status(201).json({
      message: {
        id: message.id,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
        sender: message.sender,
      },
    });
  }

  // ── PUT: mark conversation as read ───────────────────────────────────────
  if (req.method === "PUT") {
    await db.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: me } },
      data: { lastReadAt: new Date() },
    });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
