import { db } from "@/lib/db";

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_SUBMISSIONS = 3;

/**
 * Returns true if the email has exceeded the submission rate limit.
 * Uses the UserApplication table — no external cache needed.
 */
export async function isSubmissionThrottled(email: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  const count = await db.userApplication.count({
    where: {
      email,
      createdAt: { gte: since },
    },
  });
  return count >= MAX_SUBMISSIONS;
}

/**
 * Returns true if the email is on the blocked list.
 */
export async function isEmailBlocked(email: string): Promise<boolean> {
  const row = await db.blockedEmail.findUnique({ where: { email } });
  return row !== null;
}
