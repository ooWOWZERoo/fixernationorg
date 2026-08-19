import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email";
import { enrollInJourneys } from "@/lib/automation";
import { awardPoints, POINTS } from "@/lib/loyalty";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

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

  const rl = await checkRateLimit(`reg:${getClientIp(req)}`, 10, 60 * 60 * 1000);
  if (!rl.allowed) {
    return res.status(429).json({ error: "Too many attempts. Please try again later." });
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
        awardPoints(ambassadorProfile.userId, POINTS.REFERRAL_CONVERTED, "referral_converted", user.id).catch(() => {});
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

  try {
    await sendVerificationEmail(email, token);
  } catch (err) {
    // Same defensive pattern as the referral tracking and journey
    // enrollment above — a mail-provider hiccup shouldn't crash signup
    // and strand the user with an account they can never verify or re-
    // register (the email is already taken).
    console.error("[register] Failed to send verification email:", err);
  }

  // Fire-and-forget — never block registration on automation errors
  enrollInJourneys({ trigger: "SIGNUP", userId: user.id }).catch(() => {});

  return res.json({ ok: true });
}
