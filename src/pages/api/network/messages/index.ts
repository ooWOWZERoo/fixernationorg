import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Sign in to access messages." });

  const me = session.user.id;

  // ── GET: list conversations ────────────────────────────────────────────────
  if (req.method === "GET") {
    const participations = await db.conversationParticipant.findMany({
      where: { userId: me },
      include: {
        conversation: {
          include: {
            participants: {
              include: { user: { select: { id: true, name: true, image: true } } },
            },
            messages: {
              where: { deletedAt: null },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { id: true, body: true, senderId: true, createdAt: true },
            },
          },
        },
      },
      orderBy: { conversation: { updatedAt: "desc" } },
    });

    const conversations = await Promise.all(
      participations.map(async (p) => {
        const other = p.conversation.participants
          .filter((cp) => cp.userId !== me)
          .map((cp) => cp.user);

        const lastMsg = p.conversation.messages[0] ?? null;

        const unreadCount = p.lastReadAt
          ? await db.directMessage.count({
              where: {
                conversationId: p.conversationId,
                senderId: { not: me },
                deletedAt: null,
                createdAt: { gt: p.lastReadAt },
              },
            })
          : await db.directMessage.count({
              where: {
                conversationId: p.conversationId,
                senderId: { not: me },
                deletedAt: null,
              },
            });

        return {
          id: p.conversationId,
          other,
          lastMessage: lastMsg
            ? {
                body: lastMsg.body,
                senderId: lastMsg.senderId,
                createdAt: lastMsg.createdAt.toISOString(),
              }
            : null,
          unreadCount,
          updatedAt: p.conversation.updatedAt.toISOString(),
        };
      })
    );

    return res.status(200).json({ conversations });
  }

  // ── POST: start or find 1:1 conversation ──────────────────────────────────
  if (req.method === "POST") {
    const parsed = z
      .object({ recipientId: z.string().min(1) })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "recipientId required." });

    const { recipientId } = parsed.data;
    if (recipientId === me) return res.status(400).json({ error: "Can't message yourself." });

    const recipient = await db.user.findUnique({ where: { id: recipientId } });
    if (!recipient) return res.status(404).json({ error: "User not found." });

    // Look for an existing 1:1 conversation between these two users
    const existing = await db.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: me } } },
          { participants: { some: { userId: recipientId } } },
        ],
      },
      include: { participants: true },
    });

    if (existing && existing.participants.length === 2) {
      return res.status(200).json({ conversationId: existing.id, created: false });
    }

    // Create new conversation
    const conv = await db.conversation.create({
      data: {
        participants: {
          create: [{ userId: me }, { userId: recipientId }],
        },
      },
    });

    return res.status(201).json({ conversationId: conv.id, created: true });
  }

  return res.status(405).end();
}
