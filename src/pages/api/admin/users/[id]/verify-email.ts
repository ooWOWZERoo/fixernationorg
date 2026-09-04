import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAction, getClientIp } from "@/lib/audit";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

// Manually marks an account's email as verified. Needed because sign-in's
// authorize() blocks login entirely when emailVerified is unset — via the
// exact same generic "email or password incorrect" message a wrong
// password would produce — regardless of whether the password itself is
// correct. An account can end up here if its original verification email
// never arrived (e.g. during an outgoing-mail outage) and was never
// resent/clicked.
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

  await db.user.update({ where: { id }, data: { emailVerified: new Date() } });

  await logAction({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "user.email_verified_by_admin",
    resource: "User",
    resourceId: id,
    metadata: { targetEmail: target.email },
    ip: getClientIp(req),
  });

  return res.status(200).json({ ok: true, alreadyVerified: false });
}
