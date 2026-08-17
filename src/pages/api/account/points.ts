import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const history = await db.loyaltyPoint.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const total = history.reduce((sum, r) => sum + r.points, 0);

  return res.json({
    total,
    history: history.map((r) => ({
      id: r.id,
      points: r.points,
      reason: r.reason,
      note: r.resourceId ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
