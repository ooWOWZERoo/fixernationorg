import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/db";
import { randomUUID } from "crypto";

// cPanel calls this URL via HTTP:
//   https://fixernation.org/api/cron?job=daily-digest&token=CRON_SECRET

const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

type JobHandler = () => Promise<{ message: string }>;

const JOBS: Record<string, JobHandler> = {
  "health-check": async () => ({ message: "Health check OK" }),
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
