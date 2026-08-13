import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().optional().nullable(),
  features: z.array(z.string()).optional(),
  imageUrl: z.string().optional().nullable(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id } = req.query as { id: string };

  if (req.method === "GET") {
    const product = await db.product.findUnique({
      where: { id },
      include: { prices: { orderBy: { createdAt: "asc" } } },
    });
    if (!product) return res.status(404).json({ error: "Not found" });
    return res.status(200).json(product);
  }

  if (req.method === "PUT") {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    try {
      const product = await db.product.update({ where: { id }, data: parsed.data });
      return res.status(200).json(product);
    } catch {
      return res.status(404).json({ error: "Not found" });
    }
  }

  if (req.method === "DELETE") {
    try {
      await db.product.delete({ where: { id } });
      return res.status(204).end();
    } catch {
      return res.status(404).json({ error: "Not found" });
    }
  }

  res.setHeader("Allow", "GET, PUT, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
