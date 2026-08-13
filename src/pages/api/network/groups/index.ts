import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);

  const groups = await db.socialGroup.findMany({
    where: { visibility: "PUBLIC" },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { members: true } } },
  });

  if (!session) return res.status(200).json({ groups, memberships: [], requests: [] });

  const [memberships, requests] = await Promise.all([
    db.groupMember.findMany({
      where: { userId: session.user.id },
      select: { groupId: true, role: true },
    }),
    db.groupRequest.findMany({
      where: { userId: session.user.id, status: "PENDING" },
      select: { groupId: true },
    }),
  ]);

  return res.status(200).json({ groups, memberships, requests });
}
