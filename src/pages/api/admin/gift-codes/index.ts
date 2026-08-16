import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateUniqueGiftCode } from "@/lib/giftcode";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const createSchema = z.object({
  grantedRole: z.enum(["MEMBER", "PROVIDER", "AMBASSADOR"]).optional(),
  description: z.string().max(300).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
  quantity: z.number().int().min(1).max(100).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    const codes = await db.giftCode.findMany({
      orderBy: { createdAt: "desc" },
      include: { redeemedBy: { select: { name: true, email: true } } },
    });
    return res.json(codes);
  }

  if (req.method === "POST") {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });

    const { grantedRole = "MEMBER", description, expiresAt, quantity = 1 } = parsed.data;

    const codes = await Promise.all(
      Array.from({ length: quantity }, async () => {
        const code = await generateUniqueGiftCode();
        return db.giftCode.create({
          data: {
            code,
            grantedRole,
            description: description?.trim() || null,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
          },
        });
      })
    );

    return res.status(201).json(codes);
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
