import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateUniqueReferralCode } from "@/lib/referral";

const schema = z.object({
  territory: z.string().max(100).optional(),
  bio: z.string().max(1000).optional(),
  website: z.string().url().max(300).or(z.literal("")).optional(),
  phone: z.string().max(30).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.user.role !== "AMBASSADOR") return res.status(403).json({ error: "Forbidden" });

  if (req.method === "PUT") {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });

    const { territory, bio, website, phone } = parsed.data;

    const existing = await db.ambassadorProfile.findUnique({ where: { userId: session.user.id } });
    const referralCode = existing?.referralCode ?? (await generateUniqueReferralCode());

    const profile = await db.ambassadorProfile.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        referralCode,
        territory: territory?.trim() || null,
        bio: bio?.trim() || null,
        website: website?.trim() || null,
        phone: phone?.trim() || null,
      },
      update: {
        territory: territory?.trim() || null,
        bio: bio?.trim() || null,
        website: website?.trim() || null,
        phone: phone?.trim() || null,
      },
    });

    return res.status(200).json({ referralCode: profile.referralCode });
  }

  res.setHeader("Allow", "PUT");
  return res.status(405).json({ error: "Method not allowed" });
}
