import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const events = await db.event.findMany({
    where: { startsAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    orderBy: { startsAt: "asc" },
    take: 50,
    select: { id: true, title: true, slug: true, coverUrl: true, startsAt: true, location: true, isVirtual: true, description: true },
  });
  return res.status(200).json(events);
}
