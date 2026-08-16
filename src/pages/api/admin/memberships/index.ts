import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

type MembershipDb = {
  userMembership: {
    findMany: (a: Record<string, unknown>) => Promise<unknown[]>;
    count: (a: Record<string, unknown>) => Promise<number>;
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { status } = req.query;
  const membershipDb = db as never as MembershipDb;

  const where: Record<string, unknown> = {};
  if (status && typeof status === "string") {
    where.status = status;
  }

  const memberships = await membershipDb.userMembership.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      price: { include: { product: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return res.status(200).json(memberships);
}
