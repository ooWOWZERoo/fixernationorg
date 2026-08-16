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
  const products = await db.product.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    take: 50,
    select: { id: true, name: true, imageUrl: true, description: true },
  });
  return res.status(200).json(products);
}
