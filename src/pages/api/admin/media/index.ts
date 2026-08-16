import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    const { q, folder } = req.query;
    const where: Record<string, unknown> = {};
    if (folder) where.folder = folder;
    if (q) {
      where.OR = [
        { name: { contains: q as string, mode: "insensitive" } },
        { tags: { contains: q as string, mode: "insensitive" } },
        { alt: { contains: q as string, mode: "insensitive" } },
      ];
    }

    const assets = await db.mediaAsset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return res.status(200).json(assets);
  }

  res.setHeader("Allow", "GET");
  return res.status(405).json({ error: "Method not allowed" });
}
