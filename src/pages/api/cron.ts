import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/postmark";
import { buildMorningBoostEmail } from "@/lib/emails/morning-boost";
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

  const members = await db.user.findMany({
    where: {
      emailVerified: { not: null },
      morningBoostEmails: true,
      email: { not: null },
    },
    select: { email: true, name: true },
  });

  if (members.length === 0) {
    return { message: "No opted-in members to send to" };
  }

  let sent = 0;
  let failed = 0;

  // Send in batches of 50 to stay well within Postmark rate limits
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
            htmlBody: email.htmlBody,
            textBody: email.textBody,
            messageStream: "broadcast",
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

const JOBS: Record<string, JobHandler> = {
  "health-check": async () => ({ message: "Health check OK" }),
  "morning-boost": runMorningBoost,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const jobKey = req.query.job as string | undefined;
  const token = req.query.token as string | undefined;

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
