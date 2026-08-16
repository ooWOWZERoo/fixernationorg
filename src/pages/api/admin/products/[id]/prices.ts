import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const addPriceSchema = z.object({
  interval: z.enum(["FREE_TRIAL", "MONTHLY", "ANNUAL", "ONE_TIME"]),
  amount: z.number().int().min(0),
  membershipRole: z.enum(["CONSUMER", "PROVIDER", "AMBASSADOR", "MEMBER"]).nullable().optional(),
  trialDays: z.number().int().positive().nullable().optional(),
  active: z.boolean().default(true),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id } = req.query as { id: string };

  const product = await db.product.findUnique({ where: { id }, select: { id: true } });
  if (!product) return res.status(404).json({ error: "Product not found" });

  if (req.method === "POST") {
    const parsed = addPriceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
    }
    const price = await db.price.create({
      data: { productId: id, ...parsed.data },
    });
    return res.status(201).json(price);
  }

  if (req.method === "DELETE") {
    const priceId = req.query.priceId as string;
    if (!priceId) return res.status(400).json({ error: "priceId required" });
    try {
      await db.price.delete({ where: { id: priceId, productId: id } });
      return res.status(204).end();
    } catch {
      return res.status(404).json({ error: "Price not found" });
    }
  }

  res.setHeader("Allow", "POST, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
