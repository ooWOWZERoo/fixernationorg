import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { awardPoints } from "@/lib/loyalty";

const AwardSchema = z.object({
  userId: z.string().min(1),
  points: z.number().int().min(1).max(1000),
  note: z.string().min(1).max(200),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole ?? "")) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const PAGE_SIZE = 50;

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      }),
      db.user.count({ where }),
    ]);

    const userIds = users.map((u) => u.id);
    const pointGroups = await db.loyaltyPoint.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds } },
      _sum: { points: true },
      _max: { createdAt: true },
    });

    const pointMap: Record<string, { total: number; lastAt: string | null }> = {};
    for (const g of pointGroups) {
      pointMap[g.userId] = {
        total: g._sum.points ?? 0,
        lastAt: g._max.createdAt ? g._max.createdAt.toISOString() : null,
      };
    }

    return res.json({
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        total: pointMap[u.id]?.total ?? 0,
        lastAt: pointMap[u.id]?.lastAt ?? null,
      })),
      total,
      page,
      pages: Math.ceil(total / PAGE_SIZE),
    });
  }

  if (req.method === "POST") {
    const parsed = AwardSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
    }

    const { userId, points, note } = parsed.data;

    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return res.status(404).json({ error: "User not found" });

    await awardPoints(userId, points, "manual_award", note);

    return res.json({ ok: true });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
