import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const Schema = z.object({ email: z.string().email() });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rl = await checkRateLimit(`fp:${getClientIp(req)}`, 5, 15 * 60 * 1000);
  if (!rl.allowed) {
    return res.status(429).json({ error: "Too many attempts. Please try again later." });
  }

  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Valid email required" });

  const { email } = parsed.data;

  // Always return success — don't reveal whether the email exists
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  if (user?.passwordHash) {
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.verificationToken.deleteMany({ where: { identifier: `reset:${email}` } });
    await db.verificationToken.create({
      data: { identifier: `reset:${email}`, token, expires },
    });

    await sendPasswordResetEmail(email, token);
  }

  return res.json({ ok: true });
}
