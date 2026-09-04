import type { NextApiRequest, NextApiResponse } from "next";
import { randomBytes, randomUUID } from "crypto";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { buildMorningBoostEmail } from "@/lib/emails/morning-boost";
import { buildApplicationExpiredEmail } from "@/lib/emails/expiration";
import { buildExpirationReminderEmail } from "@/lib/emails/expiration-reminder";
import { buildAccountInviteEmail } from "@/lib/emails/account-invite";
import { loadTemplate } from "@/lib/template-engine";
import { applyApplicationTags } from "@/lib/application-crm";
import { sendCampaignNow, continueCampaignSend } from "@/lib/send-campaign";
import {
  buildRenewalReminder30Email,
  buildRenewalReminder7Email,
  buildGiftExpiring30Email,
  buildGiftExpiring7Email,
} from "@/lib/emails/membership";

// Vercel Hobby's default execution limit (~10s) isn't enough to send a
// large-audience campaign in one invocation; this raises the ceiling so
// each hop of the self-continuing send chain (see send-campaign.ts) can get
// through more of the audience before it has to hand off to the next hop.
export const config = { maxDuration: 60 };

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://fixernation.org";

// cPanel calls this URL via HTTP:
//   https://fixernation.org/api/cron?job=morning-boost&token=CRON_SECRET

const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

type JobHandler = () => Promise<{ message: string }>;

async function runMorningBoost(): Promise<{ message: string }> {
  // Reversible kill switch — flip via the existing generic Setting editor at
  // /admin/settings (no redeploy needed) once the recurring-campaign
  // replacement (see runCampaignRecurringDispatch) has been verified for a
  // real day or two. Default (key unset) is unchanged existing behavior.
  const killSwitch = await db.setting.findUnique({ where: { key: "morning_boost_direct_send_enabled" } });
  if (killSwitch?.value === "false") {
    return { message: "Disabled via Setting morning_boost_direct_send_enabled — recurring campaign system active" };
  }

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const entry = await db.morningBoost.findFirst({
    where: {
      publishedAt: { gte: startOfDay, lt: endOfDay },
    },
    select: {
      title: true,
      body: true,
      authorName: true,
      publishedAt: true,
      slug: true,
      excerpt: true,
      imageUrl: true,
    },
  });

  if (!entry || !entry.publishedAt) {
    return { message: "No Morning Boost entry scheduled for today — skipped" };
  }

  // Primary: contacts with MORNING_BOOST consent (CRM model).
  // Fallback union: users with morningBoostEmails=true who don't have a Contact yet.
  const consentedContacts = await db.contact.findMany({
    where: {
      consents: { some: { topic: "MORNING_BOOST", optedIn: true } },
      user: { emailVerified: { not: null } },
    },
    select: { email: true, user: { select: { name: true } } },
  });

  const contactEmails = new Set(consentedContacts.map((c) => c.email));

  const legacyUsers = await db.user.findMany({
    where: {
      emailVerified: { not: null },
      morningBoostEmails: true,
      crmContact: null,
    },
    select: { email: true, name: true },
  });

  const members = [
    ...consentedContacts.map((c) => ({ email: c.email, name: c.user?.name ?? null })),
    ...legacyUsers.filter((u) => !contactEmails.has(u.email)),
  ];

  if (members.length === 0) {
    return { message: "No opted-in members to send to" };
  }

  let sent = 0;
  let failed = 0;

  const BATCH = 50;
  for (let i = 0; i < members.length; i += BATCH) {
    const batch = members.slice(i, i + BATCH);
    await Promise.allSettled(
      batch.map(async (member) => {
        try {
          const email = buildMorningBoostEmail(
            { ...entry, publishedAt: new Date(entry.publishedAt!) },
            member.name
          );
          await sendEmail({
            to: member.email,
            subject: email.subject,
            html: email.html,
            text: email.text,
          });
          sent++;
        } catch {
          failed++;
        }
      })
    );
  }

  return {
    message: `Morning Boost "${entry.title}" sent to ${sent} member${sent !== 1 ? "s" : ""}${failed > 0 ? ` (${failed} failed)` : ""}`,
  };
}

async function runCampaignScheduler(): Promise<{ message: string }> {
  const now = new Date();

  // Reset any campaigns stuck in SENDING for > 30 min (e.g. serverless timeout mid-send)
  const stuckThreshold = new Date(now.getTime() - 30 * 60 * 1000);
  const stuck = await db.campaign.findMany({
    where: { status: "SENDING", updatedAt: { lt: stuckThreshold } },
    select: { id: true },
  });
  if (stuck.length > 0) {
    const stuckIds = stuck.map((c) => c.id);
    await db.campaignSend.deleteMany({
      where: { campaignId: { in: stuckIds }, status: "QUEUED" },
    });
    await db.campaign.updateMany({
      where: { id: { in: stuckIds } },
      data: { status: "DRAFT" },
    });
  }

  const campaigns = await db.campaign.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: now } },
    select: { id: true },
  });

  if (campaigns.length === 0) return { message: "No campaigns due to send" };

  // Delegates to the same full-featured send logic the manual "Send now"
  // button uses (audienceRules + listId, suppression, A/B, PUSH) — this
  // used to be a separate, listId-only reimplementation that silently
  // skipped any scheduled campaign using rule-based audienceRules.
  let processed = 0;
  for (const campaign of campaigns) {
    const result = await sendCampaignNow(campaign.id).catch(() => null);
    if (result) processed++;
  }

  return { message: `Processed ${processed} of ${campaigns.length} scheduled campaign${campaigns.length !== 1 ? "s" : ""}` };
}

// UTC calendar-day window for "published today" — shared shape with the
// Morning Boost content lookup below, kept inline since it's only two lines.
function utcDayWindow(now: Date): { startOfDay: Date; endOfDay: Date } {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  return { startOfDay, endOfDay };
}

// Vercel Hobby caps cron jobs at once-per-day, so this runs on the same
// fixed daily schedule as the job itself (vercel.json: 7am UTC, the same
// slot the legacy direct Morning Boost sender used) rather than checking
// each template against its own chosen time — there's only one invocation
// a day, so every due template fires at that single moment. recurrenceTime
// is stored (fixed to "07:00" at creation) for a possible future Pro-tier
// upgrade to per-template times, but isn't used to gate firing here.
async function runCampaignRecurringDispatch(): Promise<{ message: string }> {
  const now = new Date();
  const scheduledDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const templates = await db.campaign.findMany({
    where: {
      isRecurring: true,
      recurrenceActive: true,
      parentCampaignId: null,
      channelType: "EMAIL",
      isAbTest: false,
    },
  });

  let dispatched = 0;
  let skipped = 0;

  for (const template of templates) {
    try {
      // Atomically claim today's slot for this template — a unique
      // violation means another invocation already handled today, even
      // under overlapping cron ticks (on top of the CronJob per-job lock
      // below, which already prevents two concurrent runs of this job).
      let run;
      try {
        run = await db.recurrenceRun.create({
          data: { templateId: template.id, scheduledDate, outcome: "SENT" },
        });
      } catch {
        skipped++;
        continue;
      }

      if (template.recurrenceSource === "MORNING_BOOST") {
        const { startOfDay, endOfDay } = utcDayWindow(now);
        const entry = await db.morningBoost.findFirst({
          where: { publishedAt: { gte: startOfDay, lt: endOfDay } },
          select: { id: true, title: true, body: true, authorName: true, publishedAt: true, slug: true, excerpt: true, imageUrl: true },
        });

        if (!entry || !entry.publishedAt || entry.id === template.lastMorningBoostId) {
          await db.recurrenceRun.update({
            where: { id: run.id },
            data: { outcome: entry ? "SKIPPED_DUPLICATE_CONTENT" : "SKIPPED_NO_CONTENT" },
          });
          skipped++;
          continue;
        }

        const { subject, html, text } = buildMorningBoostEmail(
          { ...entry, publishedAt: new Date(entry.publishedAt) },
          null
        );

        const child = await db.campaign.create({
          data: {
            name: `${template.name} — ${scheduledDate.toISOString().slice(0, 10)}`,
            channelType: "EMAIL",
            subject,
            htmlBody: html,
            textBody: text,
            fromName: template.fromName,
            fromEmail: template.fromEmail,
            listId: template.listId,
            audienceRules: template.audienceRules ?? undefined,
            parentCampaignId: template.id,
            status: "DRAFT",
          },
        });

        await db.campaign.update({ where: { id: template.id }, data: { lastMorningBoostId: entry.id } });
        await db.recurrenceRun.update({ where: { id: run.id }, data: { childCampaignId: child.id } });
        await sendCampaignNow(child.id);
        dispatched++;
      } else {
        // Static recurring content: resend the template's own subject/body as-is.
        const child = await db.campaign.create({
          data: {
            name: `${template.name} — ${scheduledDate.toISOString().slice(0, 10)}`,
            channelType: "EMAIL",
            subject: template.subject,
            htmlBody: template.htmlBody,
            textBody: template.textBody,
            fromName: template.fromName,
            fromEmail: template.fromEmail,
            listId: template.listId,
            audienceRules: template.audienceRules ?? undefined,
            parentCampaignId: template.id,
            status: "DRAFT",
          },
        });
        await db.recurrenceRun.update({ where: { id: run.id }, data: { childCampaignId: child.id } });
        await sendCampaignNow(child.id);
        dispatched++;
      }
    } catch (err) {
      console.error(`[campaign-recurring-dispatch] template ${template.id} failed:`, err);
    }
  }

  return { message: `Dispatched ${dispatched}, skipped ${skipped} of ${templates.length} recurring template${templates.length !== 1 ? "s" : ""}` };
}

// Applications in accepted/onboarding states expire after 30 days of inactivity.
// "Inactivity" = reviewedAt (last admin action) or submittedAt has not advanced in 30+ days.
async function runApplicationExpiration() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const stale = await db.userApplication.findMany({
    where: {
      status: { in: ["ACCEPTED_ONBOARDING_REQUIRED", "ONBOARDING_IN_PROGRESS", "PAYMENT_PENDING"] },
      OR: [
        { reviewedAt: { lte: cutoff } },
        { reviewedAt: null, submittedAt: { lte: cutoff } },
      ],
    },
    select: { id: true, email: true, name: true, type: true, userId: true },
  });

  let expired = 0;
  for (const app of stale) {
    await db.userApplication.update({
      where: { id: app.id },
      data: { status: "EXPIRED" },
    });

    applyApplicationTags({
      id: app.id,
      email: app.email,
      name: app.name,
      type: app.type,
      status: "EXPIRED",
      userId: app.userId,
    }).catch(() => {});

    try {
      await sendEmail({
        to: app.email,
        ...buildApplicationExpiredEmail(app.name, app.type as "PROVIDER" | "AMBASSADOR"),
      });
    } catch (err) {
      console.error(`[application-expiration] Email failed for ${app.id}:`, err);
    }

    expired++;
  }

  return { message: `Expired ${expired} application${expired !== 1 ? "s" : ""}` };
}

// Send 14-day and 7-day reminder emails to accepted/onboarding apps nearing expiration.
// Each app only ever gets one reminder email (tracked via expirationReminderSentAt).
async function runApplicationExpirationReminders(): Promise<{ message: string }> {
  const now = new Date();
  // Expiration = 30 days after reviewedAt (or submittedAt fallback)
  // 14-day reminder window: apps whose clock started 16-30 days ago (14-0 days left)
  // We send at the 14-day mark and the 7-day mark. Track in expirationReminderSentAt.
  // Strategy: find apps where expirationReminderSentAt is null and days-remaining <= 14
  const cutoff30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const cutoff16 = new Date(now.getTime() - 16 * 24 * 60 * 60 * 1000);

  const upcoming = await db.userApplication.findMany({
    where: {
      status: { in: ["ACCEPTED_ONBOARDING_REQUIRED", "ONBOARDING_IN_PROGRESS", "PAYMENT_PENDING"] },
      expirationReminderSentAt: null,
      OR: [
        { reviewedAt: { gte: cutoff30, lte: cutoff16 } },
        { reviewedAt: null, submittedAt: { gte: cutoff30, lte: cutoff16 } },
      ],
    },
    select: { id: true, email: true, name: true, type: true, reviewedAt: true, submittedAt: true },
  });

  let sent = 0;
  for (const app of upcoming) {
    const clockStart = app.reviewedAt ?? app.submittedAt ?? now;
    const expiresAt = new Date(clockStart.getTime() + 30 * 24 * 60 * 60 * 1000);
    const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

    if (daysLeft <= 0) continue;

    try {
      await sendEmail({
        to: app.email,
        ...buildExpirationReminderEmail(app.name, app.type as "PROVIDER" | "AMBASSADOR", daysLeft),
      });
      await db.userApplication.update({
        where: { id: app.id },
        data: { expirationReminderSentAt: now },
      });
      sent++;
    } catch (err) {
      console.error(`[expiration-reminders] Failed for ${app.id}:`, err);
    }
  }

  return { message: `Sent ${sent} expiration reminder${sent !== 1 ? "s" : ""}` };
}

// Resend account invites for accepted apps where userId is still null and invite is 7+ days old.
async function runAccountInvitationReminders(): Promise<{ message: string }> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const apps = await db.userApplication.findMany({
    where: {
      userId: null,
      accountInviteToken: { not: null },
      accountInviteExpiresAt: { gt: now }, // not yet expired
      accountInviteSentAt: { lte: sevenDaysAgo }, // sent 7+ days ago
    },
    select: { id: true, email: true, name: true, type: true },
  });

  let sent = 0;
  for (const app of apps) {
    const newToken = randomBytes(32).toString("hex");
    const newExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await db.userApplication.update({
      where: { id: app.id },
      data: {
        accountInviteToken: newToken,
        accountInviteExpiresAt: newExpiry,
        accountInviteSentAt: now,
      },
    });

    const appType = app.type as "PROVIDER" | "AMBASSADOR";
    const firstName = (app.name ?? "").split(" ")[0] || "there";
    const role = appType === "PROVIDER" ? "service provider" : "brand ambassador";
    const inviteUrl = `${APP_URL}/invite/${newToken}`;

    const email =
      (await loadTemplate("account.invitation", { first_name: firstName, role, invite_url: inviteUrl }))
      ?? buildAccountInviteEmail(app.name, appType, inviteUrl);

    try {
      await sendEmail({ to: app.email, ...email });
      sent++;
    } catch (err) {
      console.error(`[account-invitation-reminders] Email failed for ${app.id}:`, err);
    }
  }

  return { message: `Sent ${sent} account invitation reminder${sent !== 1 ? "s" : ""}` };
}

async function runAutomationTick(): Promise<{ message: string }> {
  const { tickAutomations } = await import("@/lib/automation");
  const { processed, completed, failed } = await tickAutomations();
  return {
    message: `Automation tick: ${processed} processed, ${completed} completed${failed > 0 ? `, ${failed} failed` : ""}`,
  };
}

async function runCampaignRecovery(): Promise<{ message: string }> {
  const stuckThreshold = new Date(Date.now() - 30 * 60 * 1000);

  const stuck = await db.campaign.findMany({
    where: { status: "SENDING", updatedAt: { lt: stuckThreshold } },
    select: { id: true },
  });

  if (stuck.length === 0) return { message: "No stuck campaigns found" };

  const stuckIds = stuck.map((c) => c.id);

  await db.campaignSend.deleteMany({
    where: { campaignId: { in: stuckIds }, status: "QUEUED" },
  });

  const result = await db.campaign.updateMany({
    where: { id: { in: stuckIds } },
    data: { status: "DRAFT" },
  });

  return { message: `Recovered ${result.count} stuck campaign${result.count !== 1 ? "s" : ""}` };
}

async function runExpiredTokenCleanup(): Promise<{ message: string }> {
  const result = await db.verificationToken.deleteMany({
    where: { expires: { lt: new Date() } },
  });
  return { message: `Deleted ${result.count} expired verification token${result.count !== 1 ? "s" : ""}` };
}

// SP-67 Stage 1 — UserMembership.source/GiftCode.membershipDurationDays are new
// columns the local Prisma client doesn't know about yet.
type GiftBackfillMembershipDb = {
  userMembership: {
    findUnique: (a: unknown) => Promise<{ id: string; source: string; status: string } | null>;
    upsert: (a: unknown) => Promise<unknown>;
  };
};

// One-time manual backfill: every GiftCode redeemed before SP-67 shipped WAS
// the free 90-day book promo (confirmed retroactively), so this treats all
// redeemed codes as such and gives each one a real UserMembership row —
// making them participate in the renewal/expiry system going forward.
// Not scheduled — trigger once via ?job=membership-gift-retroactive-backfill&token=CRON_SECRET.
async function runMembershipGiftRetroactiveBackfill(): Promise<{ message: string }> {
  const giftPrice = await db.price.findFirst({
    where: { product: { slug: "free-90-day-book-gift" } },
    select: { id: true },
  });
  if (!giftPrice) {
    return { message: "Gift membership Price (slug free-90-day-book-gift) not found — deploy the SP-67 migration first." };
  }

  const giftCodes = await db.giftCode.findMany({
    where: { redeemedByUserId: { not: null }, redeemedAt: { not: null } },
    select: { redeemedByUserId: true, redeemedAt: true },
  });

  const membershipDb = db as never as GiftBackfillMembershipDb;
  const processedUserIds = new Set<string>();
  let created = 0;
  let downgraded = 0;
  let skipped = 0;

  for (const gc of giftCodes) {
    const userId = gc.redeemedByUserId;
    const redeemedAt = gc.redeemedAt;
    if (!userId || !redeemedAt) {
      skipped++;
      continue;
    }
    if (processedUserIds.has(userId)) {
      // A user who redeemed more than one gift code only gets one UserMembership row (1:1).
      skipped++;
      continue;
    }
    processedUserIds.add(userId);

    const existing = await membershipDb.userMembership.findUnique({ where: { userId } });

    if (existing?.source === "GIFT_CODE") {
      // Already backfilled in a prior run of this job.
      skipped++;
      continue;
    }
    if (existing?.source === "STRIPE" && (existing.status === "ACTIVE" || existing.status === "TRIALING")) {
      // Never let a gift-code backfill touch a real, currently-active paid subscription.
      skipped++;
      continue;
    }

    const currentPeriodEnd = new Date(redeemedAt.getTime() + 90 * 24 * 60 * 60 * 1000);
    const isExpired = currentPeriodEnd < new Date();
    const status = isExpired ? "CANCELED" : "ACTIVE";

    await membershipDb.userMembership.upsert({
      where: { userId },
      create: {
        userId,
        priceId: giftPrice.id,
        source: "GIFT_CODE",
        status,
        currentPeriodEnd,
      },
      update: {
        priceId: giftPrice.id,
        source: "GIFT_CODE",
        status,
        currentPeriodEnd,
        stripeSubscriptionId: null,
        cancelAtPeriodEnd: false,
        trialEnd: null,
        updatedAt: new Date(),
      },
    });
    created++;

    if (isExpired) {
      // Mirrors what customer.subscription.deleted already does for expired paid subs.
      await db.user.update({ where: { id: userId }, data: { role: "CONSUMER" } });
      downgraded++;
    }
  }

  return {
    message: `Gift membership backfill complete — created ${created}, downgraded ${downgraded}, skipped ${skipped}`,
  };
}

// SP-67 Stage 3 — renewal30ReminderSentAt/renewal7ReminderSentAt/source are
// new UserMembership columns the local Prisma client doesn't know about yet
// (same situation as GiftBackfillMembershipDb above).
type RenewalMembershipRow = {
  id: string;
  userId: string;
  status: string;
  source: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  user: { email: string; name: string | null };
  price: { amount: number; product: { name: string } };
};
type RenewalMembershipDb = {
  userMembership: {
    findMany: (a: unknown) => Promise<RenewalMembershipRow[]>;
    update: (a: unknown) => Promise<unknown>;
    updateMany: (a: unknown) => Promise<{ count: number }>;
  };
};

function renewalFirstName(name: string | null): string {
  return (name ?? "").split(" ")[0] || "there";
}

function formatRenewalDate(d: Date): string {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// 30/7-day renewal reminders (Stripe-sourced, still auto-renewing) and
// 30/7-day expiring-soon notices (gift-code-sourced, never auto-renew) —
// plus, in the same invocation, expiring out gift memberships whose free
// period has already ended. Combined into one job since this project's
// Vercel Hobby plan can't afford a separate cron slot per tier; all three
// pieces are independently idempotent (guarded by the *ReminderSentAt null
// checks and the source/status filters), so running them together is safe.
async function runMembershipRenewalReminders(): Promise<{ message: string }> {
  const now = new Date();
  const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const membershipDb = db as never as RenewalMembershipDb;

  let sent30 = 0;
  let sent7 = 0;
  let giftExpired = 0;

  // ── 30-day tier ──────────────────────────────────────────────────────────
  const due30 = await membershipDb.userMembership.findMany({
    where: {
      renewal30ReminderSentAt: null,
      status: { in: ["ACTIVE", "TRIALING"] },
      currentPeriodEnd: { gt: in7d, lte: in30d },
      OR: [{ source: "STRIPE", cancelAtPeriodEnd: false }, { source: "GIFT_CODE" }],
    },
    include: { user: { select: { email: true, name: true } }, price: { include: { product: true } } },
  });

  for (const m of due30) {
    if (!m.currentPeriodEnd) continue;
    try {
      const firstName = renewalFirstName(m.user.name);
      const renewalDate = formatRenewalDate(m.currentPeriodEnd);

      if (m.source === "STRIPE") {
        const billingUrl = `${APP_URL}/account/billing`;
        const amount = formatCents(m.price.amount);
        const email =
          (await loadTemplate("membership.renewal_reminder_30", {
            first_name: firstName,
            plan_name: m.price.product.name,
            renewal_date: renewalDate,
            amount,
            billing_url: billingUrl,
          })) ?? buildRenewalReminder30Email(m.user.name, m.price.product.name, renewalDate, amount, billingUrl);
        await sendEmail({ to: m.user.email, ...email });
      } else {
        const upgradeUrl = `${APP_URL}/join`;
        const email =
          (await loadTemplate("membership.gift_expiring_30", {
            first_name: firstName,
            renewal_date: renewalDate,
            upgrade_url: upgradeUrl,
          })) ?? buildGiftExpiring30Email(m.user.name, renewalDate, upgradeUrl);
        await sendEmail({ to: m.user.email, ...email });
      }
    } catch (err) {
      console.error(`[membership-renewal-reminders] 30-day email failed for membership ${m.id}:`, err);
    } finally {
      await membershipDb.userMembership.update({
        where: { id: m.id },
        data: { renewal30ReminderSentAt: now },
      });
      sent30++;
    }
  }

  // ── 7-day tier ───────────────────────────────────────────────────────────
  const due7 = await membershipDb.userMembership.findMany({
    where: {
      renewal7ReminderSentAt: null,
      status: { in: ["ACTIVE", "TRIALING"] },
      currentPeriodEnd: { gt: now, lte: in7d },
      OR: [{ source: "STRIPE", cancelAtPeriodEnd: false }, { source: "GIFT_CODE" }],
    },
    include: { user: { select: { email: true, name: true } }, price: { include: { product: true } } },
  });

  for (const m of due7) {
    if (!m.currentPeriodEnd) continue;
    try {
      const firstName = renewalFirstName(m.user.name);
      const renewalDate = formatRenewalDate(m.currentPeriodEnd);

      if (m.source === "STRIPE") {
        const billingUrl = `${APP_URL}/account/billing`;
        const amount = formatCents(m.price.amount);
        const email =
          (await loadTemplate("membership.renewal_reminder_7", {
            first_name: firstName,
            plan_name: m.price.product.name,
            renewal_date: renewalDate,
            amount,
            billing_url: billingUrl,
          })) ?? buildRenewalReminder7Email(m.user.name, m.price.product.name, renewalDate, amount, billingUrl);
        await sendEmail({ to: m.user.email, ...email });
      } else {
        const upgradeUrl = `${APP_URL}/join`;
        const email =
          (await loadTemplate("membership.gift_expiring_7", {
            first_name: firstName,
            renewal_date: renewalDate,
            upgrade_url: upgradeUrl,
          })) ?? buildGiftExpiring7Email(m.user.name, renewalDate, upgradeUrl);
        await sendEmail({ to: m.user.email, ...email });
      }
    } catch (err) {
      console.error(`[membership-renewal-reminders] 7-day email failed for membership ${m.id}:`, err);
    } finally {
      await membershipDb.userMembership.update({
        where: { id: m.id },
        data: { renewal7ReminderSentAt: now },
      });
      sent7++;
    }
  }

  // ── Gift-code expiry enforcement ────────────────────────────────────────
  // Mirrors what customer.subscription.deleted already does for the Stripe
  // path (same two writes, same role value) — this is the actual expiry
  // enforcement for the free 90-day gift membership.
  const expiredGifts = await membershipDb.userMembership.findMany({
    where: { source: "GIFT_CODE", status: "ACTIVE", currentPeriodEnd: { lt: now } },
    include: { user: { select: { email: true, name: true } }, price: { include: { product: true } } },
  });

  for (const m of expiredGifts) {
    try {
      await membershipDb.userMembership.update({
        where: { id: m.id },
        data: { status: "CANCELED" },
      });
      await db.user.update({ where: { id: m.userId }, data: { role: "CONSUMER" } });
      giftExpired++;
    } catch (err) {
      console.error(`[membership-renewal-reminders] gift expiry failed for membership ${m.id}:`, err);
    }
  }

  return {
    message: `30-day: ${sent30} sent, 7-day: ${sent7} sent, gift expired: ${giftExpired}`,
  };
}

const JOBS: Record<string, JobHandler> = {
  "health-check": async () => ({ message: "Health check OK" }),
  "morning-boost": runMorningBoost,
  "campaign-scheduler": runCampaignScheduler,
  "campaign-recurring-dispatch": runCampaignRecurringDispatch,
  "automation-tick": runAutomationTick,
  "application-expiration": runApplicationExpiration,
  "application-expiration-reminders": runApplicationExpirationReminders,
  "account-invitation-reminders": runAccountInvitationReminders,
  "campaign-recovery": runCampaignRecovery,
  "expired-token-cleanup": runExpiredTokenCleanup,
  "membership-gift-retroactive-backfill": runMembershipGiftRetroactiveBackfill,
  "membership-renewal-reminders": runMembershipRenewalReminders,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const jobKey = req.query.job as string | undefined;

  // Accept token via Authorization: Bearer header (Vercel Cron) or ?token= query param (legacy)
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  const queryToken = req.query.token as string | undefined;
  const token = bearerToken ?? queryToken;

  const expected = process.env.CRON_SECRET;
  if (!expected || token !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!jobKey) {
    return res.status(400).json({ error: "Missing ?job= parameter" });
  }

  // Not a scheduled cron entry — a self-triggered hop in the chunked send
  // chain (see triggerContinuation in send-campaign.ts). It rides on this
  // route's existing token auth but deliberately skips the generic
  // once-a-day CronJob lock below: that lock is keyed by jobKey, and a
  // single "campaign-send-continue" key would incorrectly serialize hops
  // for two different campaigns sending at once. The per-campaign guard
  // (campaign.status === "SENDING") inside continueCampaignSend is what
  // actually protects this one.
  if (jobKey === "campaign-send-continue") {
    const campaignId = req.query.campaignId as string | undefined;
    if (!campaignId) return res.status(400).json({ error: "Missing campaignId" });
    const result = await continueCampaignSend(campaignId);
    return res.status(200).json({ ok: true, job: jobKey, campaignId, ...result });
  }

  const jobHandler = JOBS[jobKey];
  if (!jobHandler) {
    return res.status(404).json({ error: `Unknown job: ${jobKey}` });
  }

  const runId = randomUUID();
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - LOCK_TIMEOUT_MS);

  const existing = await db.cronJob.findUnique({ where: { key: jobKey } });

  if (
    existing?.status === "RUNNING" &&
    existing.lockedAt &&
    existing.lockedAt > staleThreshold
  ) {
    return res.status(200).json({
      skipped: true,
      reason: "Job is already running",
      lockedBy: existing.lockedBy,
    });
  }

  if (existing?.lastRunAt) {
    const hoursSince =
      (now.getTime() - existing.lastRunAt.getTime()) / 1000 / 60 / 60;
    if (hoursSince > 25) {
      console.warn(`[cron] ${jobKey} missed run — last ran ${hoursSince.toFixed(1)}h ago`);
    }
  }

  await db.cronJob.upsert({
    where: { key: jobKey },
    create: {
      key: jobKey,
      status: "RUNNING",
      lockedAt: now,
      lockedBy: runId,
      startedAt: now,
    },
    update: {
      status: "RUNNING",
      lockedAt: now,
      lockedBy: runId,
      startedAt: now,
      errorMessage: null,
    },
  });

  try {
    const result = await jobHandler();

    await db.cronJob.update({
      where: { key: jobKey },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        lastRunAt: new Date(),
        runCount: { increment: 1 },
        lockedAt: null,
        lockedBy: null,
      },
    });

    return res.status(200).json({ ok: true, job: jobKey, runId, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[cron] ${jobKey} failed:`, err);

    await db.cronJob.update({
      where: { key: jobKey },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorMessage: message,
        runCount: { increment: 1 },
        lockedAt: null,
        lockedBy: null,
      },
    });

    return res.status(500).json({ ok: false, job: jobKey, error: message });
  }
}
