import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email";
import { enrollInJourneys } from "@/lib/automation";

const RegisterSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  ref: z.string().max(20).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
  }

  const { name, email, password, ref } = parsed.data;

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    // Return success even for duplicates to avoid user enumeration
    return res.json({ ok: true });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.user.create({
    data: { name, email, passwordHash },
  });

  if (ref) {
    try {
      const ambassadorProfile = await db.ambassadorProfile.findUnique({ where: { referralCode: ref } });
      if (ambassadorProfile) {
        await db.referral.create({
          data: {
            ambassadorId: ambassadorProfile.id,
            referralCode: ref,
            referredUserId: user.id,
            convertedAt: new Date(),
          },
        });
      }
    } catch {
      // fire and forget — referral tracking never breaks signup
    }
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await db.verificationToken.deleteMany({ where: { identifier: `verify:${user.id}` } });
  await db.verificationToken.create({
    data: { identifier: `verify:${user.id}`, token, expires },
  });

  await sendVerificationEmail(email, token);

  // Fire-and-forget — never block registration on automation errors
  enrollInJourneys({ trigger: "SIGNUP", userId: user.id }).catch(() => {});

  return res.json({ ok: true });
}
