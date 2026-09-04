import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import crypto from "crypto";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];
const BASE_URL = process.env.NEXTAUTH_URL ?? "https://fixernation.org";

const Schema = z.object({ email: z.string().email() });

// The self-service /forgot-password flow already creates a valid reset
// token even when the notification email itself fails to send (it just
// swallows that failure so a mail-provider hiccup doesn't turn into a
// misleading 500 or reveal account existence). This endpoint reuses that
// same token-creation logic and hands the resulting link back directly, so
// an admin can unblock account recovery when outgoing mail is down - the
// recipient still sets their own new password by opening the link, this
// never handles or stores the actual password value.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Valid email required" });
  const { email } = parsed.data;

  const user = await db.user.findUnique({ where: { email }, select: { id: true, passwordHash: true } });
  if (!user) return res.status(404).json({ error: "No account with that email." });
  if (!user.passwordHash) {
    return res.status(400).json({ error: "This account has no password set (OAuth-only or never activated)." });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000);

  await db.verificationToken.deleteMany({ where: { identifier: `reset:${email}` } });
  await db.verificationToken.create({ data: { identifier: `reset:${email}`, token, expires } });

  let emailSent = true;
  try {
    await sendPasswordResetEmail(email, token);
  } catch (err) {
    emailSent = false;
    console.error("[generate-reset-link] Failed to send reset email (link still valid):", err);
  }

  return res.status(200).json({
    resetUrl: `${BASE_URL}/reset-password?token=${token}`,
    expiresAt: expires.toISOString(),
    emailSent,
  });
}
