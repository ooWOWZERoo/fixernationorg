import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.adminRole !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Forbidden — SUPER_ADMIN only" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }

  const now = new Date();

  const [admins, pendingInvites] = await Promise.all([
    db.user.findMany({
      where: { adminRole: { in: ["ADMIN", "SUPER_ADMIN"] } },
      select: { id: true, name: true, email: true, adminRole: true, createdAt: true },
      orderBy: [{ adminRole: "asc" }, { createdAt: "asc" }],
    }),
    (db as never as { adminInvite: { findMany: (a: unknown) => Promise<unknown[]> } })
      .adminInvite.findMany({
        where: { claimedAt: null, expiresAt: { gt: now } },
        select: { id: true, email: true, role: true, invitedById: true, createdAt: true, expiresAt: true },
        orderBy: { createdAt: "desc" },
      }),
  ]);

  return res.status(200).json({
    admins: JSON.parse(JSON.stringify(admins)),
    pendingInvites: JSON.parse(JSON.stringify(pendingInvites)),
  });
}
