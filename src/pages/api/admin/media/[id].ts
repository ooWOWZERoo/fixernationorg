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

  const { id } = req.query as { id: string };

  if (req.method === "DELETE") {
    const asset = await db.mediaAsset.findUnique({ where: { id } });
    if (!asset) return res.status(404).json({ error: "Not found" });
    await db.mediaAsset.delete({ where: { id } });
    return res.status(204).end();
  }

  if (req.method === "PATCH") {
    const { alt, tags, name } = req.body ?? {};
    const asset = await db.mediaAsset.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(alt !== undefined && { alt }),
        ...(tags !== undefined && { tags }),
      },
    });
    return res.status(200).json(asset);
  }

  res.setHeader("Allow", "DELETE, PATCH");
  return res.status(405).json({ error: "Method not allowed" });
}
