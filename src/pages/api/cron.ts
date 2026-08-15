import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { buildMorningBoostEmail } from "@/lib/emails/morning-boost";
import { buildApplicationExpiredEmail } from "@/lib/emails/expiration";
import { applyApplicationTags } from "@/lib/application-crm";
import { randomUUID } from "crypto";

// cPanel calls this URL via HTTP:
//   https://fixernation.org/api/cron?job=morning-boost&token=CRON_SECRET

const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

type JobHandler = () => Promise<{ message: string }>;

async function runMorningBoost(): Promise<{ message: string }> {
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

  const campaigns = await db.campaign.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: now } },
    select: { id: true, name: true },
  });

  if (campaigns.length === 0) return { message: "No campaigns due to send" };

  for (const campaign of campaigns) {
    // Delegate to the send endpoint logic inline
    const full = await db.campaign.findUnique({
      where: { id: campaign.id },
      include: { list: true },
    });
    if (!full?.listId) continue;

    const members = await db.contactListMember.findMany({
      where: { listId: full.listId },
      include: {
        contact: {
          select: { id: true, email: true, firstName: true },
        },
      },
    });

    const eligible = members.filter(() => true); // consent filtering handled by subscribe/unsub
    if (eligible.length === 0) continue;

    await db.campaign.update({ where: { id: campaign.id }, data: { status: "SENDING" } });
    await db.campaignSend.createMany({
      data: eligible.map((m) => ({ campaignId: campaign.id, contactId: m.contactId })),
      skipDuplicates: true,
    });

    let sent = 0;
    const BATCH = 20;
    for (let i = 0; i < eligible.length; i += BATCH) {
      const batch = eligible.slice(i, i + BATCH);
      await Promise.allSettled(
        batch.map(async (m) => {
          try {
            await sendEmail({
              to: m.contact.email,
              subject: full.subject,
              html: full.htmlBody,
              text: full.textBody ?? full.subject,
            });
            await db.campaignSend.update({
              where: { campaignId_contactId: { campaignId: campaign.id, contactId: m.contactId } },
              data: { status: "SENT", sentAt: now },
            });
            sent++;
          } catch {
            // mark as failed but don't block others
          }
        })
      );
    }

    await db.campaign.update({
      where: { id: campaign.id },
      data: { status: "SENT", sentAt: now },
    });
  }

  return { message: `Processed ${campaigns.length} scheduled campaign${campaigns.length !== 1 ? "s" : ""}` };
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

const JOBS: Record<string, JobHandler> = {
  "health-check": async () => ({ message: "Health check OK" }),
  "morning-boost": runMorningBoost,
  "campaign-scheduler": runCampaignScheduler,
  "application-expiration": runApplicationExpiration,
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
