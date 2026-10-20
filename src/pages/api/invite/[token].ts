import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { autoJoinGroups } from "@/lib/groups";
import { recordEvent } from "@/lib/application-events";
import { enrollInJourneys } from "@/lib/automation";
import { generateUniqueReferralCode } from "@/lib/referral";
import { provisionAffiliate } from "@/lib/affiliate";
import { ensureContactForUser, ensureDefaultMorningBoostConsent, ensureAffiliateListMembership } from "@/lib/contacts";

// Resolves the Contact once and runs the role-grant side effects that hang
// off it. Previously, Morning Boost consent and Affiliates list membership
// each independently called ensureContactForUser for the SAME user at the
// same time -- two concurrent find-or-create/update races on the same row,
// which is what actually produced the FK violations seen in production
// (confirmed: they persisted even after making the calls awaited, just
// shifting from .create() to .update() failures). Resolving the contact
// once here removes that race at the source, and -- since every downstream
// step below is now a single idempotent write instead of its own 2-4-step
// chain -- awaiting this whole batch adds much less latency than the
// previous per-helper duplication did.
async function runRoleGrantSideEffects(
  logLabel: string,
  userId: string,
  applicationId: string,
  email: string,
  name: string | null,
  newRole: "PROVIDER" | "AMBASSADOR" | "AFFILIATE"
): Promise<void> {
  const contactId = await ensureContactForUser(userId, email, name, "signup");

  const grantOps: { name: string; promise: Promise<unknown> }[] = [
    { name: "morningBoostConsent", promise: ensureDefaultMorningBoostConsent(contactId, "signup") },
  ];

  if (newRole === "AMBASSADOR") {
    grantOps.push({
      name: "ambassadorProfile",
      promise: generateUniqueReferralCode().then((referralCode) =>
        db.ambassadorProfile.upsert({
          where: { userId },
          create: { userId, referralCode },
          update: {},
        })
      ),
    });
    grantOps.push({
      name: "provisionAffiliate(AMBASSADOR)",
      promise: provisionAffiliate({ userId, applicationId, affiliateType: "AMBASSADOR", assignedBy: "invite-claim" }),
    });
  }

  if (newRole === "AFFILIATE") {
    grantOps.push({
      name: "provisionAffiliate(AFFILIATE)",
      promise: provisionAffiliate({ userId, applicationId, affiliateType: "AFFILIATE", assignedBy: "invite-claim" }),
    });
    grantOps.push({ name: "affiliateListMembership", promise: ensureAffiliateListMembership(contactId) });
  }

  const results = await Promise.allSettled(grantOps.map((op) => op.promise));
  results.forEach((result, i) => {
    if (result.status === "rejected") {
      console.error(`[invite] ${logLabel} role grant task "${grantOps[i].name}" failed:`, result.reason);
    }
  });
}

const postSchema = z.object({
  name: z.string().min(2).max(100),
  password: z.string().min(8).max(128),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { token } = req.query as { token: string };

  // ── GET — validate token + return applicant info ──────────────────────────────
  if (req.method === "GET") {
    const application = await db.userApplication.findUnique({
      where: { accountInviteToken: token },
      select: {
        id: true,
        name: true,
        email: true,
        type: true,
        status: true,
        userId: true,
        accountInviteExpiresAt: true,
      },
    });

    if (!application) {
      return res.status(404).json({ error: "INVALID_TOKEN", message: "This invite link is not valid." });
    }
    if (application.userId) {
      return res.status(409).json({ error: "ALREADY_CLAIMED", message: "This invite has already been used." });
    }
    if (application.accountInviteExpiresAt && application.accountInviteExpiresAt < new Date()) {
      return res.status(410).json({ error: "EXPIRED", message: "This invite link has expired. Contact us to request a new one." });
    }

    return res.status(200).json({
      name: application.name,
      email: application.email,
      type: application.type,
    });
  }

  // ── POST — create account ─────────────────────────────────────────────────────
  if (req.method === "POST") {
    const parsed = postSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const application = await db.userApplication.findUnique({
      where: { accountInviteToken: token },
      select: {
        id: true,
        name: true,
        email: true,
        type: true,
        status: true,
        userId: true,
        accountInviteExpiresAt: true,
      },
    });

    if (!application) {
      return res.status(404).json({ error: "INVALID_TOKEN", message: "This invite link is not valid." });
    }
    if (application.userId) {
      return res.status(409).json({ error: "ALREADY_CLAIMED", message: "This invite has already been used." });
    }
    if (application.accountInviteExpiresAt && application.accountInviteExpiresAt < new Date()) {
      return res.status(410).json({ error: "EXPIRED", message: "This invite link has expired. Contact us to request a new one." });
    }

    // Check for an existing account with this email
    const existing = await db.user.findUnique({
      where: { email: application.email },
      select: { id: true, role: true },
    });
    if (existing) {
      const newRole = application.type === "PROVIDER" ? "PROVIDER"
        : application.type === "AMBASSADOR" ? "AMBASSADOR"
        : application.type === "AFFILIATE" ? "AFFILIATE"
        : null;

      await db.userApplication.update({
        where: { id: application.id },
        data: {
          userId: existing.id,
          accountInviteToken: null,
          accountInviteExpiresAt: null,
        },
      });

      if (newRole) {
        await db.user.update({ where: { id: existing.id }, data: { role: newRole } });
        await runRoleGrantSideEffects("existing-account", existing.id, application.id, application.email, application.name, newRole);

        autoJoinGroups(existing.id, newRole).catch(() => {});
        enrollInJourneys({ trigger: "ROLE_CHANGE", userId: existing.id, triggerConfig: { role: newRole } }).catch(() => {});
        recordEvent(application.id, "ACCOUNT_LINKED", null, { userId: existing.id, role: newRole }).catch(() => {});
      }

      return res.status(200).json({ ok: true, linked: true });
    }

    const { name, password } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 10);
    const newRole = application.type === "PROVIDER" ? "PROVIDER"
      : application.type === "AMBASSADOR" ? "AMBASSADOR"
      : application.type === "AFFILIATE" ? "AFFILIATE"
      : "MEMBER";

    const user = await db.user.create({
      data: {
        email: application.email,
        name: name.trim(),
        passwordHash,
        role: newRole as "PROVIDER" | "AMBASSADOR" | "AFFILIATE" | "MEMBER",
        emailVerified: new Date(),
      },
      select: { id: true },
    });

    await db.userApplication.update({
      where: { id: application.id },
      data: {
        userId: user.id,
        accountInviteToken: null,
        accountInviteExpiresAt: null,
      },
    });

    recordEvent(application.id, "ACCOUNT_CREATED", null, {
      userId: user.id,
      role: newRole,
    }).catch((err) => console.error("[events] ACCOUNT_CREATED record failed:", err));

    if (newRole === "PROVIDER" || newRole === "AMBASSADOR" || newRole === "AFFILIATE") {
      await runRoleGrantSideEffects("new-account", user.id, application.id, application.email, name.trim(), newRole);
    }

    // Auto-join role-based groups and fire automation triggers
    try {
      await autoJoinGroups(user.id, newRole);
    } catch (err) {
      console.error("[invite] autoJoinGroups failed:", err);
    }

    // SIGNUP fires first (new account), then ROLE_CHANGE for the specific role granted
    enrollInJourneys({ trigger: "SIGNUP", userId: user.id }).catch(() => {});
    enrollInJourneys({ trigger: "ROLE_CHANGE", userId: user.id, triggerConfig: { role: newRole } }).catch(() => {});

    return res.status(201).json({ ok: true });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
