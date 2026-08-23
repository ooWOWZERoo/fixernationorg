import { PrismaClient } from "@prisma/client";

// Direct DB access for e2e assertions/setup that the app's own APIs don't
// expose (reading a real email-verification token). Scoped to its own
// PrismaClient using TEST_DATABASE_URL so it never depends on the app's
// runtime db singleton or its DATABASE_URL.
let prisma: PrismaClient | null = null;

function client(): PrismaClient {
  if (!prisma) {
    const url = process.env.TEST_DATABASE_URL;
    if (!url) throw new Error("TEST_DATABASE_URL not set — see .env.test");
    prisma = new PrismaClient({ datasources: { db: { url } } });
  }
  return prisma;
}

export async function getVerificationToken(email: string): Promise<string | null> {
  const user = await client().user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return null;
  const record = await client().verificationToken.findFirst({
    where: { identifier: `verify:${user.id}` },
    orderBy: { expires: "desc" },
  });
  return record?.token ?? null;
}

export async function getUserId(email: string): Promise<string | null> {
  const user = await client().user.findUnique({ where: { email }, select: { id: true } });
  return user?.id ?? null;
}

export async function deleteTestUser(email: string): Promise<void> {
  await client().user.delete({ where: { email } }).catch(() => {});
}

export async function getChallengeBySlug(
  slug: string
): Promise<{ id: string; loyaltyPoints: number; stepIds: string[] } | null> {
  const challenge = await client().challenge.findUnique({
    where: { slug },
    select: { id: true, loyaltyPoints: true, steps: { select: { id: true } } },
  });
  if (!challenge) return null;
  return { id: challenge.id, loyaltyPoints: challenge.loyaltyPoints, stepIds: challenge.steps.map((s) => s.id) };
}

export async function getLoyaltyPointByResourceId(
  resourceId: string
): Promise<{ points: number; reason: string } | null> {
  const row = await client().loyaltyPoint.findFirst({ where: { resourceId }, select: { points: true, reason: true } });
  return row ?? null;
}

export async function getAmbassadorReferralCode(email: string): Promise<string | null> {
  const profile = await client().ambassadorProfile.findFirst({
    where: { user: { email } },
    select: { referralCode: true },
  });
  return profile?.referralCode ?? null;
}

export async function deleteReferralByReferredUserId(userId: string): Promise<void> {
  await client().referral.deleteMany({ where: { referredUserId: userId } });
}

export async function getContactTagNames(contactId: string): Promise<string[]> {
  const rows = await client().contactTag.findMany({ where: { contactId }, select: { tag: true } });
  return rows.map((r) => r.tag);
}

export async function getAutomationEnrollment(
  journeyId: string,
  contactId: string
): Promise<{ status: string; currentStep: number } | null> {
  const row = await client().automationEnrollment.findFirst({
    where: { journeyId, contactId },
    orderBy: { enrolledAt: "desc" },
    select: { status: true, currentStep: true },
  });
  return row ?? null;
}

// Test-fixture helper: force an enrollment straight to a given status
// without needing to actually engineer a real automation failure (e.g. a
// broken webhook). Used to verify the admin overview's status counting and
// filtering, not the automation engine's own failure-detection logic.
export async function forceEnrollmentStatus(
  journeyId: string,
  contactId: string,
  status: string
): Promise<void> {
  await client().automationEnrollment.updateMany({
    where: { journeyId, contactId },
    data: { status: status as "ACTIVE" | "COMPLETED" | "PAUSED" | "CANCELLED" | "FAILED" },
  });
}

// Test-fixture helpers: simulate the two "needs attention" conditions the
// admin campaigns list detects, without waiting for a real 30-minute
// serverless timeout or a real cron cycle to pass. Prisma respects an
// explicit value for an `@updatedAt` field when one is provided, so
// backdating `updatedAt` here isn't overwritten to "now".
export async function forceCampaignStuckSending(campaignId: string): Promise<void> {
  await client().campaign.update({
    where: { id: campaignId },
    data: { status: "SENDING", updatedAt: new Date(Date.now() - 31 * 60 * 1000) },
  });
}

export async function forceCampaignOverdueScheduled(campaignId: string): Promise<void> {
  await client().campaign.update({
    where: { id: campaignId },
    data: { status: "SCHEDULED", scheduledAt: new Date(Date.now() - 60 * 60 * 1000) },
  });
}

export async function getLatestContactMergeHistory(
  survivorId: string
): Promise<{ absorbedId: string; absorbedEmail: string } | null> {
  const row = await client().contactMergeHistory.findFirst({
    where: { survivorId },
    orderBy: { mergedAt: "desc" },
    select: { absorbedId: true, absorbedEmail: true },
  });
  return row ?? null;
}

export async function getContactMessageByEmail(
  email: string
): Promise<{ id: string; subject: string; message: string } | null> {
  const row = await client().contactMessage.findFirst({
    where: { email },
    orderBy: { createdAt: "desc" },
    select: { id: true, subject: true, message: true },
  });
  return row ?? null;
}

export async function getFixerQuestionByEmail(
  email: string
): Promise<{ id: string; subject: string | null; body: string } | null> {
  const row = await client().fixerQuestion.findFirst({
    where: { email },
    orderBy: { createdAt: "desc" },
    select: { id: true, subject: true, body: true },
  });
  return row ?? null;
}

// Both /api/contact and /api/ask-the-fixer are rate-limited 5/hour per IP via
// a shared RateLimitEntry table (SP-42). Since these tests hit the real
// production endpoints from a shared IP, and the isolated + full-suite run
// pattern used across this project would otherwise burn through that quota
// within a single deploy verification, reset the counters directly rather
// than hoping 5 requests/hour is enough headroom.
export async function resetRateLimit(prefix: string): Promise<void> {
  await client().rateLimitEntry.deleteMany({ where: { key: { startsWith: `${prefix}:` } } });
}

export async function closeTestDb(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
