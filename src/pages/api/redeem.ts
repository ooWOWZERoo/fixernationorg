import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  code: z.string().min(1).max(40).transform((s) => s.trim().toUpperCase()),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Sign in to redeem a code" });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid code format" });

  const { code } = parsed.data;

  const giftCode = await db.giftCode.findUnique({ where: { code } });

  if (!giftCode) return res.status(404).json({ error: "That code doesn't exist." });
  if (giftCode.redeemedAt) return res.status(409).json({ error: "That code has already been redeemed." });
  if (giftCode.expiresAt && giftCode.expiresAt < new Date()) {
    return res.status(410).json({ error: "That code has expired." });
  }

  await db.$transaction([
    db.giftCode.update({
      where: { id: giftCode.id },
      data: { redeemedByUserId: session.user.id, redeemedAt: new Date() },
    }),
    db.user.update({
      where: { id: session.user.id },
      data: { role: giftCode.grantedRole },
    }),
  ]);

  return res.json({ grantedRole: giftCode.grantedRole });
}
