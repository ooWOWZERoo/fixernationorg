import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const addPriceSchema = z.object({
  interval: z.enum(["FREE_TRIAL", "MONTHLY", "ANNUAL", "ONE_TIME"]),
  amount: z.number().int().min(0),
  currency: z.string().default("usd"),
  trialDays: z.number().int().min(1).optional().nullable(),
  membershipRole: z.enum(["CONSUMER", "PROVIDER", "AMBASSADOR"]).optional().nullable(),
  active: z.boolean().default(true),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id: productId } = req.query as { id: string };

  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product) return res.status(404).json({ error: "Product not found" });

  if (req.method === "POST") {
    const parsed = addPriceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const price = await db.price.create({
      data: { ...parsed.data, productId },
    });
    return res.status(201).json(price);
  }

  if (req.method === "DELETE") {
    const priceId = req.query.priceId as string;
    if (!priceId) return res.status(400).json({ error: "priceId required" });
    try {
      await db.price.delete({ where: { id: priceId, productId } });
      return res.status(204).end();
    } catch {
      return res.status(404).json({ error: "Price not found" });
    }
  }

  res.setHeader("Allow", "POST, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
