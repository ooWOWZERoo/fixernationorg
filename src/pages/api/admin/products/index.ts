import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const createSchema = z.object({
  type: z.enum(["MEMBERSHIP", "BOOK", "DIGITAL", "PHYSICAL"]),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  description: z.string().optional(),
  features: z.array(z.string()).default([]),
  imageUrl: z.string().url().optional().or(z.literal("")),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    const products = await db.product.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        _count: { select: { prices: { where: { active: true } } } },
      },
    });
    return res.status(200).json(products);
  }

  if (req.method === "POST") {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const { imageUrl, ...rest } = parsed.data;
    const product = await db.product.create({
      data: { ...rest, imageUrl: imageUrl || null },
    });
    return res.status(201).json(product);
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
