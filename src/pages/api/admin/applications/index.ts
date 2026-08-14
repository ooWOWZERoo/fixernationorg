import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    const applications = await db.userApplication.findMany({
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).json(applications);
  }

  res.setHeader("Allow", "GET");
  return res.status(405).json({ error: "Method not allowed" });
}
