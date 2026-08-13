import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

function isAdmin(role: string) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

const reviewBody = z.object({
  requestId: z.string(),
  action: z.enum(["APPROVE", "REJECT"]),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !isAdmin(session.user.role)) return res.status(403).json({ error: "Forbidden." });

  const groupId = req.query.id as string;
  const group = await db.socialGroup.findUnique({ where: { id: groupId } });
  if (!group) return res.status(404).json({ error: "Group not found." });

  if (req.method === "GET") {
    const requests = await db.groupRequest.findMany({
      where: { groupId, status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
    });
    return res.status(200).json({
      requests: requests.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        reviewedAt: r.reviewedAt?.toISOString() ?? null,
        user: { ...r.user, createdAt: r.user.createdAt.toISOString() },
      })),
    });
  }

  if (req.method === "PUT") {
    const parsed = reviewBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid data." });

    const { requestId, action } = parsed.data;
    const request = await db.groupRequest.findUnique({ where: { id: requestId } });
    if (!request || request.groupId !== groupId) {
      return res.status(404).json({ error: "Request not found." });
    }

    if (action === "APPROVE") {
      await db.$transaction([
        db.groupRequest.update({
          where: { id: requestId },
          data: { status: "APPROVED", reviewedAt: new Date(), reviewedBy: session.user.id },
        }),
        db.groupMember.upsert({
          where: { groupId_userId: { groupId, userId: request.userId } },
          create: { groupId, userId: request.userId, role: "MEMBER" },
          update: {},
        }),
      ]);
    } else {
      await db.groupRequest.update({
        where: { id: requestId },
        data: { status: "REJECTED", reviewedAt: new Date(), reviewedBy: session.user.id },
      });
    }

    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
