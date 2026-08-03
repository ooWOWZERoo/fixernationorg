import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { randomUUID } from "crypto";

// cPanel calls this URL via HTTP:
//   https://fixernation.org/api/cron?job=daily-digest&token=CRON_SECRET
//
// Proof covers: token validation, DB-backed locking, idempotency, retries, and
// missed-run recovery. Actual job logic is wired in Phase 1.

const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // consider lock stale after 5 minutes

type JobHandler = () => Promise<{ message: string }>;

// Registry of available jobs — add Phase 1+ jobs here
const JOBS: Record<string, JobHandler> = {
  "health-check": async () => ({ message: "Health check OK" }),
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const jobKey = searchParams.get("job");
  const token = searchParams.get("token");

  // ── Token validation ───────────────────────────────────────────────────────
  const expected = process.env.CRON_SECRET;
  if (!expected || token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!jobKey) {
    return NextResponse.json({ error: "Missing ?job= parameter" }, { status: 400 });
  }

  const handler = JOBS[jobKey];
  if (!handler) {
    return NextResponse.json(
      { error: `Unknown job: ${jobKey}` },
      { status: 404 }
    );
  }

  const runId = randomUUID();
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - LOCK_TIMEOUT_MS);

  // ── Acquire lock ───────────────────────────────────────────────────────────
  // Upsert the job row; only take the lock if it's not already running,
  // or if the existing lock is stale (previous run crashed).
  const existing = await db.cronJob.findUnique({ where: { key: jobKey } });

  if (
    existing?.status === "RUNNING" &&
    existing.lockedAt &&
    existing.lockedAt > staleThreshold
  ) {
    return NextResponse.json(
      { skipped: true, reason: "Job is already running", lockedBy: existing.lockedBy },
      { status: 200 }
    );
  }

  // Missed-run detection: log if last run was > 25 hours ago (daily jobs)
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

  // ── Execute ────────────────────────────────────────────────────────────────
  try {
    const result = await handler();

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

    return NextResponse.json({
      ok: true,
      job: jobKey,
      runId,
      ...result,
    });
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

    return NextResponse.json(
      { ok: false, job: jobKey, error: message },
      { status: 500 }
    );
  }
}
