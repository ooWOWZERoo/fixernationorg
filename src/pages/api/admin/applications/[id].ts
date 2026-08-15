import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAction, getClientIp } from "@/lib/audit";
import { autoJoinGroups } from "@/lib/groups";
import { sendEmail } from "@/lib/email";
import { generateUniqueReferralCode } from "@/lib/referral";
import { buildApplicationApprovedEmail, buildApplicationRejectedEmail } from "@/lib/emails/application-decision";
import {
  buildUnderReviewEmail,
  buildInfoRequestEmail,
  buildConditionalAcceptanceEmail,
} from "@/lib/emails/application-status";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const ACCEPT_STATUSES = [
  "UNDER_REVIEW",
  "ADDITIONAL_INFO_REQUIRED",
  "RESUBMITTED",
  "CONDITIONALLY_ACCEPTED",
  "ACCEPTED_ONBOARDING_REQUIRED",
  "APPROVED",
  "DECLINED",
  "REJECTED",
  "WITHDRAWN",
  "EXPIRED",
] as const;

const patchSchema = z.object({
  status: z.enum(ACCEPT_STATUSES),
  reviewNotes: z.string().max(2000).optional(),
  infoRequestNotes: z.string().max(2000).optional(),
});

const ACCEPTANCE_STATUSES = new Set(["ACCEPTED_ONBOARDING_REQUIRED", "APPROVED"]);
const REJECTION_STATUSES = new Set(["DECLINED", "REJECTED"]);
const REVIEWABLE_FROM = new Set([
  "PENDING", "SUBMITTED", "UNDER_REVIEW",
  "ADDITIONAL_INFO_REQUIRED", "RESUBMITTED", "CONDITIONALLY_ACCEPTED",
]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id } = req.query as { id: string };

  // ── GET ──────────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    const application = await db.userApplication.findUnique({
      where: { id },
      include: {
        providerDetail: true,
        ambassadorDetail: true,
      },
    });
    if (!application) return res.status(404).json({ error: "Not found" });
    return res.status(200).json(application);
  }

  // ── PATCH ─────────────────────────────────────────────────────────────────
  if (req.method === "PATCH") {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const { status, reviewNotes, infoRequestNotes } = parsed.data;

    const application = await db.userApplication.findUnique({ where: { id } });
    if (!application) return res.status(404).json({ error: "Not found" });

    if (!REVIEWABLE_FROM.has(application.status)) {
      return res.status(409).json({ error: "This application has already been finalized." });
    }

    const updated = await db.userApplication.update({
      where: { id },
      data: {
        status,
        reviewedAt: new Date(),
        reviewedBy: session.user.email,
        reviewNotes: reviewNotes?.trim() || null,
        infoRequestNotes: infoRequestNotes?.trim() || null,
      },
    });

    // Role promotion on acceptance
    if (ACCEPTANCE_STATUSES.has(status) && application.userId) {
      const newRole = application.type === "PROVIDER" ? "PROVIDER"
        : application.type === "AMBASSADOR" ? "AMBASSADOR"
        : null;

      if (newRole) {
        const prevUser = await db.user.findUnique({
          where: { id: application.userId },
          select: { role: true },
        });
        await db.user.update({ where: { id: application.userId }, data: { role: newRole } });

        const tasks: Promise<unknown>[] = [
          logAction({
            actorId: session.user.id,
            actorEmail: session.user.email,
            action: "user.role_changed",
            resource: "User",
            resourceId: application.userId,
            metadata: { from: prevUser?.role, to: newRole, reason: `Application ${id} accepted` },
            ip: getClientIp(req),
          }),
          autoJoinGroups(application.userId, newRole),
        ];

        if (newRole === "AMBASSADOR") {
          tasks.push(
            generateUniqueReferralCode().then((referralCode) =>
              db.ambassadorProfile.upsert({
                where: { userId: application.userId! },
                create: { userId: application.userId!, referralCode },
                update: {},
              })
            )
          );
        }

        await Promise.all(tasks);
      }
    }

    await logAction({
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: `application.${status.toLowerCase()}`,
      resource: "UserApplication",
      resourceId: id,
      metadata: {
        type: application.type,
        applicantEmail: application.email,
        reviewNotes: reviewNotes ?? null,
        infoRequestNotes: infoRequestNotes ?? null,
      },
      ip: getClientIp(req),
    });

    // Status-specific emails — fire and forget
    try {
      const appType = application.type as "PROVIDER" | "AMBASSADOR";
      const displayName = application.name;

      if (status === "UNDER_REVIEW") {
        await sendEmail({
          to: application.email,
          ...buildUnderReviewEmail(displayName, appType),
        });
      } else if (status === "ADDITIONAL_INFO_REQUIRED" && infoRequestNotes?.trim()) {
        await sendEmail({
          to: application.email,
          ...buildInfoRequestEmail(displayName, appType, infoRequestNotes.trim()),
        });
      } else if (status === "CONDITIONALLY_ACCEPTED") {
        await sendEmail({
          to: application.email,
          ...buildConditionalAcceptanceEmail(displayName, appType, reviewNotes),
        });
      } else if (ACCEPTANCE_STATUSES.has(status)) {
        await sendEmail({
          to: application.email,
          ...buildApplicationApprovedEmail(displayName, appType),
        });
      } else if (REJECTION_STATUSES.has(status)) {
        await sendEmail({
          to: application.email,
          ...buildApplicationRejectedEmail(displayName, appType),
        });
      }
    } catch (err) {
      console.error("[application] Failed to send status email:", err);
    }

    return res.status(200).json(updated);
  }

  res.setHeader("Allow", "GET, PATCH");
  return res.status(405).json({ error: "Method not allowed" });
}
