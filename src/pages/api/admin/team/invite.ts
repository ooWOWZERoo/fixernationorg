import type { NextApiRequest, NextApiResponse } from "next";
import { randomBytes } from "crypto";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { logAction, getClientIp } from "@/lib/audit";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://fixernation.org";

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "SUPER_ADMIN"]),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.adminRole !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Forbidden — SUPER_ADMIN only" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }

  const parsed = InviteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
  }

  const { role } = parsed.data;
  const email = parsed.data.email.toLowerCase().trim();

  const existingUser = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser) {
    return res.status(409).json({
      error: "An account already exists for this email. Use the Users page to update their role instead.",
    });
  }

  type AdminInviteDb = {
    adminInvite: {
      updateMany: (a: unknown) => Promise<unknown>;
      create: (a: unknown) => Promise<{ id: string; email: string; role: string; createdAt: Date; expiresAt: Date }>;
    };
  };
  const inviteDb = db as never as AdminInviteDb;

  // Expire any previous pending invites for this address
  await inviteDb.adminInvite.updateMany({
    where: { email, claimedAt: null },
    data: { expiresAt: new Date() },
  });

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const invite = await inviteDb.adminInvite.create({
    data: { email, role, token, invitedById: session.user.id, expiresAt },
  });

  const setupUrl = `${APP_URL}/admin-setup/${token}`;
  const roleLabel = role === "SUPER_ADMIN" ? "Super Admin" : "Admin";
  const article = role === "SUPER_ADMIN" ? "a" : "an";

  await sendEmail({
    to: email,
    subject: `You've been invited to join Fixer Nation as ${article} ${roleLabel}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;">
        <h2 style="color:#142838;margin:0 0 12px">Admin account invitation</h2>
        <p style="color:#374151;margin:0 0 8px">
          You've been invited to create a Fixer Nation admin account.
        </p>
        <p style="color:#374151;margin:0 0 24px">
          Role assigned: <strong>${roleLabel}</strong>
        </p>
        <a href="${setupUrl}"
           style="display:inline-block;background:#142838;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
          Set up your account
        </a>
        <p style="color:#9ca3af;font-size:12px;margin:24px 0 0;">
          This invitation expires in 7 days. If you weren't expecting this, you can safely ignore it.
        </p>
        <p style="color:#9ca3af;font-size:12px;margin:4px 0 0;">
          Link: ${setupUrl}
        </p>
      </div>
    `,
    text: `You've been invited to create a Fixer Nation ${roleLabel} account.\n\nSet up your account:\n${setupUrl}\n\nThis invitation expires in 7 days. If you weren't expecting it, ignore this email.`,
  }).catch((err) => console.error("[admin-invite] email send failed:", err));

  await logAction({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "admin.invite_sent",
    resource: "AdminInvite",
    resourceId: invite.id,
    metadata: { email, role },
    ip: getClientIp(req),
  });

  return res.status(201).json({
    id: invite.id,
    email: invite.email,
    role: invite.role,
    createdAt: invite.createdAt.toISOString(),
    expiresAt: invite.expiresAt.toISOString(),
  });
}
