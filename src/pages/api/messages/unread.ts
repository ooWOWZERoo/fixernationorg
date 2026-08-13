import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(200).json({ count: 0 });

  const me = session.user.id;

  const participations = await db.conversationParticipant.findMany({
    where: { userId: me },
    select: { conversationId: true, lastReadAt: true },
  });

  let total = 0;
  for (const p of participations) {
    const count = await db.directMessage.count({
      where: {
        conversationId: p.conversationId,
        senderId: { not: me },
        deletedAt: null,
        ...(p.lastReadAt ? { createdAt: { gt: p.lastReadAt } } : {}),
      },
    });
    total += count;
  }

  return res.status(200).json({ count: total });
}
