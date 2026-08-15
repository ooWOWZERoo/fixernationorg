import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { randomBytes } from "crypto";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAction, getClientIp } from "@/lib/audit";
import { autoJoinGroups } from "@/lib/groups";
import { sendEmail } from "@/lib/email";
import { generateUniqueReferralCode } from "@/lib/referral";
import { provisionAffiliate } from "@/lib/affiliate";
import { buildApplicationApprovedEmail, buildApplicationRejectedEmail } from "@/lib/emails/application-decision";
import {
  buildUnderReviewEmail,
  buildInfoRequestEmail,
  buildConditionalAcceptanceEmail,
} from "@/lib/emails/application-status";
import { buildWelcomeProviderEmail, buildWelcomeAmbassadorEmail } from "@/lib/emails/welcome";
import { buildApplicationExpiredEmail, buildApplicationWithdrawnEmail } from "@/lib/emails/expiration";
import { applyApplicationTags } from "@/lib/application-crm";
import { loadTemplate } from "@/lib/template-engine";
import { buildAccountInviteEmail } from "@/lib/emails/account-invite";
import { recordEvent } from "@/lib/application-events";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://fixernation.org";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const ACCEPT_STATUSES = [
  "UNDER_REVIEW",
  "ADDITIONAL_INFO_REQUIRED",
  "RESUBMITTED",
  "CONDITIONALLY_ACCEPTED",
  "ACCEPTED_ONBOARDING_REQUIRED",
  "ONBOARDING_IN_PROGRESS",
  "PAYMENT_PENDING",
  "APPROVED",
  "ACTIVE",
  "DECLINED",
  "REJECTED",
  "WITHDRAWN",
  "EXPIRED",
] as const;

const patchSchema = z.object({
  status:           z.enum(ACCEPT_STATUSES),
  reviewNotes:      z.string().max(2000).optional(),
  infoRequestNotes: z.string().max(2000).optional(),
  customSubject:    z.string().max(300).optional(),
  customBody:       z.string().max(8000).optional(),
});

const ACCEPTANCE_STATUSES = new Set(["ACCEPTED_ONBOARDING_REQUIRED", "APPROVED"]);
const REJECTION_STATUSES = new Set(["DECLINED", "REJECTED"]);
const REVIEWABLE_FROM = new Set([
  "PENDING", "SUBMITTED", "UNDER_REVIEW",
  "ADDITIONAL_INFO_REQUIRED", "RESUBMITTED", "CONDITIONALLY_ACCEPTED",
  "ACCEPTED_ONBOARDING_REQUIRED", "ONBOARDING_IN_PROGRESS", "PAYMENT_PENDING",
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

    const { status, reviewNotes, infoRequestNotes, customSubject, customBody } = parsed.data;

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

    // Account invite on acceptance when no userId yet
    if (ACCEPTANCE_STATUSES.has(status) && !application.userId) {
      const inviteToken = randomBytes(32).toString("hex");
      const inviteExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await db.userApplication.update({
        where: { id },
        data: {
          accountInviteToken: inviteToken,
          accountInviteExpiresAt: inviteExpiresAt,
          accountInviteSentAt: new Date(),
        },
      });
      const appType = application.type as "PROVIDER" | "AMBASSADOR";
      const firstName = (application.name ?? "").split(" ")[0] || "there";
      const role = appType === "PROVIDER" ? "service provider" : "brand ambassador";
      const inviteUrl = `${APP_URL}/invite/${inviteToken}`;
      const inviteEmail =
        (await loadTemplate("account.invitation", { first_name: firstName, role, invite_url: inviteUrl }))
        ?? buildAccountInviteEmail(application.name, appType, inviteUrl);
      try {
        await sendEmail({ to: application.email, ...inviteEmail });
        recordEvent(id, "INVITE_SENT", session.user.email, {}).catch(
          (err) => console.error("[events] INVITE_SENT record failed:", err)
        );
      } catch (err) {
        console.error("[application] Failed to send invite email:", err);
      }
    }

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
          // Auto-provision affiliate assignment (PENDING) for ambassadors
          tasks.push(
            provisionAffiliate({
              userId: application.userId!,
              applicationId: id,
              affiliateType: "AMBASSADOR",
              assignedBy: session.user.email ?? session.user.id,
            })
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

    recordEvent(id, "STATUS_CHANGED", session.user.email, {
      from: application.status,
      to: status,
      reviewNotes: reviewNotes?.trim() || null,
      infoRequestNotes: infoRequestNotes?.trim() || null,
    }).catch((err) => console.error("[events] STATUS_CHANGED record failed:", err));

    // Status-specific emails
    // Priority: customSubject/customBody from admin pre-send editor > DB template > hardcoded fallback
    try {
      const appType = application.type as "PROVIDER" | "AMBASSADOR";
      const displayName = application.name;
      const firstName = (displayName ?? "").split(" ")[0] || "there";
      const roleLabel = appType === "PROVIDER" ? "service provider" : "brand ambassador";

      const templateVars = {
        first_name:         firstName,
        role:               roleLabel,
        info_request_notes: infoRequestNotes?.trim() ?? "",
        review_notes:       reviewNotes?.trim() ?? "",
        deadline:           "",
      };

      const STATUS_TEMPLATE_KEY: Record<string, string> = {
        UNDER_REVIEW:                 "application.under_review",
        ADDITIONAL_INFO_REQUIRED:     "application.info_required",
        CONDITIONALLY_ACCEPTED:       "application.conditionally_accepted",
        ACCEPTED_ONBOARDING_REQUIRED: "application.accepted",
        APPROVED:                     "application.accepted",
        DECLINED:                     "application.declined",
        REJECTED:                     "application.declined",
        ACTIVE:                       "activation.welcome",
        EXPIRED:                      "application.expired",
        WITHDRAWN:                    "application.withdrawn",
      };

      const templateKey = STATUS_TEMPLATE_KEY[status];

      if (templateKey) {
        // If admin provided custom content, build the email from that; otherwise load from DB or fall back to hardcoded
        let emailToSend: { subject: string; html: string; text: string } | null = null;

        if (customSubject && customBody) {
          const { previewTemplate } = await import("@/lib/template-engine");
          emailToSend = previewTemplate(customSubject, customBody, templateVars);
        } else {
          emailToSend = await loadTemplate(templateKey, templateVars);
        }

        // Hardcoded fallback if DB template missing
        if (!emailToSend) {
          if (status === "UNDER_REVIEW") {
            emailToSend = buildUnderReviewEmail(displayName, appType);
          } else if (status === "ADDITIONAL_INFO_REQUIRED" && infoRequestNotes?.trim()) {
            emailToSend = buildInfoRequestEmail(displayName, appType, infoRequestNotes.trim());
          } else if (status === "CONDITIONALLY_ACCEPTED") {
            emailToSend = buildConditionalAcceptanceEmail(displayName, appType, reviewNotes);
          } else if (ACCEPTANCE_STATUSES.has(status)) {
            emailToSend = buildApplicationApprovedEmail(displayName, appType);
          } else if (REJECTION_STATUSES.has(status)) {
            emailToSend = buildApplicationRejectedEmail(displayName, appType);
          } else if (status === "ACTIVE") {
            emailToSend = appType === "AMBASSADOR"
              ? buildWelcomeAmbassadorEmail(displayName)
              : buildWelcomeProviderEmail(displayName);
          } else if (status === "EXPIRED") {
            emailToSend = buildApplicationExpiredEmail(displayName, appType);
          } else if (status === "WITHDRAWN") {
            emailToSend = buildApplicationWithdrawnEmail(displayName, appType);
          }
        }

        // Skip info_required if there are no notes to include
        const skipInfoRequired =
          status === "ADDITIONAL_INFO_REQUIRED" && !infoRequestNotes?.trim() && !customBody;

        if (emailToSend && !skipInfoRequired) {
          await sendEmail({ to: application.email, ...emailToSend });
          recordEvent(id, "EMAIL_SENT", session.user.email, {
            template: templateKey,
            subject: emailToSend.subject,
            custom: !!(customSubject && customBody),
          }).catch((err) => console.error("[events] EMAIL_SENT record failed:", err));
        }
      }
    } catch (err) {
      console.error("[application] Failed to send status email:", err);
    }

    // Sync CRM tags — fire and forget
    applyApplicationTags({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      type: updated.type,
      status: updated.status,
      userId: updated.userId,
    }).catch((err) => console.error("[application] CRM tag sync failed:", err));

    return res.status(200).json(updated);
  }

  res.setHeader("Allow", "GET, PATCH");
  return res.status(405).json({ error: "Method not allowed" });
}
