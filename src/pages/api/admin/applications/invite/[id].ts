import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { randomBytes } from "crypto";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAction, getClientIp } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { loadTemplate } from "@/lib/template-engine";
import { buildAccountInviteEmail } from "@/lib/emails/account-invite";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];
const INVITE_STATUSES = new Set([
  "ACCEPTED_ONBOARDING_REQUIRED",
  "ONBOARDING_IN_PROGRESS",
  "PAYMENT_PENDING",
]);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://fixernation.org";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id } = req.query as { id: string };

  const application = await db.userApplication.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      type: true,
      status: true,
      userId: true,
      accountInviteToken: true,
      accountInviteSentAt: true,
      accountInviteExpiresAt: true,
    },
  });

  if (!application) return res.status(404).json({ error: "Not found" });

  // ── POST — send or resend invite ─────────────────────────────────────────────
  if (req.method === "POST") {
    if (!INVITE_STATUSES.has(application.status)) {
      return res.status(409).json({ error: "Application is not in an accepted state." });
    }
    if (application.userId) {
      return res.status(409).json({ error: "Applicant already has an account." });
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const now = new Date();

    await db.userApplication.update({
      where: { id },
      data: {
        accountInviteToken: token,
        accountInviteExpiresAt: expiresAt,
        accountInviteSentAt: now,
      },
    });

    const inviteUrl = `${APP_URL}/invite/${token}`;
    const appType = application.type as "PROVIDER" | "AMBASSADOR";
    const firstName = (application.name ?? "").split(" ")[0] || "there";
    const role = appType === "PROVIDER" ? "service provider" : "brand ambassador";

    let emailToSend: { subject: string; html: string; text: string };
    const templateResult = await loadTemplate("account.invitation", {
      first_name: firstName,
      role,
      invite_url: inviteUrl,
    });
    emailToSend = templateResult ?? buildAccountInviteEmail(application.name, appType, inviteUrl);

    try {
      await sendEmail({ to: application.email, ...emailToSend });
    } catch (err) {
      console.error("[invite] Failed to send invite email:", err);
    }

    await logAction({
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: application.accountInviteToken ? "application.invite_resent" : "application.invite_sent",
      resource: "UserApplication",
      resourceId: id,
      metadata: { email: application.email },
      ip: getClientIp(req),
    });

    return res.status(200).json({
      accountInviteSentAt: now.toISOString(),
      accountInviteExpiresAt: expiresAt.toISOString(),
    });
  }

  // ── DELETE — revoke invite ────────────────────────────────────────────────────
  if (req.method === "DELETE") {
    if (!application.accountInviteToken) {
      return res.status(409).json({ error: "No active invite to revoke." });
    }
    if (application.userId) {
      return res.status(409).json({ error: "Invite already claimed — cannot revoke." });
    }

    await db.userApplication.update({
      where: { id },
      data: {
        accountInviteToken: null,
        accountInviteExpiresAt: null,
        accountInviteSentAt: null,
      },
    });

    await logAction({
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: "application.invite_revoked",
      resource: "UserApplication",
      resourceId: id,
      metadata: { email: application.email },
      ip: getClientIp(req),
    });

    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "POST, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
