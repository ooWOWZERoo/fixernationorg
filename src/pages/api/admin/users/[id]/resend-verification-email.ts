import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAction, getClientIp } from "@/lib/audit";
import { sendVerificationEmail } from "@/lib/email";
import crypto from "crypto";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

// Generates a fresh email-verification token and resends the link, exactly
// like registration does (src/pages/api/auth/register.ts) -- for an account
// whose original verification email never arrived (e.g. during an
// outgoing-mail outage). Complements verify-email.ts's manual override: this
// lets the real link/flow work instead of bypassing it.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id } = req.query as { id: string };
  const target = await db.user.findUnique({ where: { id }, select: { id: true, email: true, adminRole: true, emailVerified: true } });
  if (!target) return res.status(404).json({ error: "User not found" });

  if (target.adminRole === "SUPER_ADMIN" && session.user.adminRole !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Only a Super Admin can act on another Super Admin's account." });
  }

  if (target.emailVerified) {
    return res.status(200).json({ ok: true, alreadyVerified: true });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours, matches register.ts

  await db.verificationToken.deleteMany({ where: { identifier: `verify:${target.id}` } });
  await db.verificationToken.create({
    data: { identifier: `verify:${target.id}`, token, expires },
  });

  try {
    await sendVerificationEmail(target.email, token);
  } catch (err) {
    console.error("[admin/resend-verification-email] Failed to send:", err);
  }

  await logAction({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "user.verification_email_resent_by_admin",
    resource: "User",
    resourceId: id,
    metadata: { targetEmail: target.email },
    ip: getClientIp(req),
  });

  return res.status(200).json({ ok: true, alreadyVerified: false });
}
