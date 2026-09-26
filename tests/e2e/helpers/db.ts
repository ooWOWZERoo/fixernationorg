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
// Backdate past the admin list page's 4-hour "no progress" threshold (see
// src/pages/admin/campaigns/index.tsx) — raised from 30 minutes because a
// large audience under the hourly send-rate cap can legitimately take many
// hours to fully drain; campaign-send-hourly-resume bumps updatedAt on every
// real progress hop, so only genuine no-progress trips this now.
export async function forceCampaignStuckSending(campaignId: string): Promise<void> {
  await client().campaign.update({
    where: { id: campaignId },
    data: { status: "SENDING", updatedAt: new Date(Date.now() - (4 * 60 + 1) * 60 * 1000) },
  });
}

// Directly upserts a CampaignAudienceSnapshot, same "force DB state"
// convention as createEmailFailure below — used to simulate the
// resolved-audience-vs-actual-sends mismatch the admin list page's
// "Partial send" flag detects.
export async function createCampaignAudienceSnapshot(
  campaignId: string,
  totalIncluded: number,
  totalSuppressed = 0
): Promise<void> {
  await client().campaignAudienceSnapshot.upsert({
    where: { campaignId },
    create: { campaignId, totalIncluded, totalSuppressed, rules: { logic: "OR", include: [], exclude: [] } },
    update: { totalIncluded, totalSuppressed, takenAt: new Date() },
  });
}

// Seeds CampaignSend rows directly, bypassing the real send pipeline, so a
// test can simulate a campaign mid-send (some SENT, some still QUEUED)
// without actually emailing anyone. Creates one throwaway Contact per email
// since CampaignSend.contactId is required and campaignId+contactId is
// unique.
export async function seedCampaignSends(
  campaignId: string,
  rows: { sent?: string[]; queued?: string[] }
): Promise<void> {
  const db_ = client();
  const entries: Array<{ email: string; status: "SENT" | "QUEUED" }> = [
    ...(rows.sent ?? []).map((email) => ({ email, status: "SENT" as const })),
    ...(rows.queued ?? []).map((email) => ({ email, status: "QUEUED" as const })),
  ];
  for (const { email, status } of entries) {
    const contact = await db_.contact.upsert({ where: { email }, create: { email }, update: {} });
    await db_.campaignSend.upsert({
      where: { campaignId_contactId: { campaignId, contactId: contact.id } },
      create: { campaignId, contactId: contact.id, status, sentAt: status === "SENT" ? new Date() : null },
      update: { status, sentAt: status === "SENT" ? new Date() : null },
    });
  }
}

export async function countCampaignSendsByStatus(campaignId: string): Promise<Record<string, number>> {
  const rows = await client().campaignSend.groupBy({
    by: ["status"],
    where: { campaignId },
    _count: { status: true },
  });
  const out: Record<string, number> = {};
  for (const r of rows) out[r.status] = r._count.status;
  return out;
}

export async function forceCampaignOverdueScheduled(campaignId: string): Promise<void> {
  await client().campaign.update({
    where: { id: campaignId },
    data: { status: "SCHEDULED", scheduledAt: new Date(Date.now() - 60 * 60 * 1000) },
  });
}

// Recurring-campaign test fixtures. The dispatch cron's "today" lookup has
// no orderBy (matching the legacy runMorningBoost query it replaces), so a
// test shouldn't assume which entry gets picked if real content also exists
// for today — these helpers ensure at least one candidate exists and let
// the test read back whatever the dispatcher actually used, rather than
// predicting it.
export async function createMorningBoostEntryToday(title: string, slug: string): Promise<{ id: string; title: string }> {
  const row = await client().morningBoost.create({
    data: { title, slug, body: `${title}\n\nQA e2e fixture body.`, publishedAt: new Date() },
    select: { id: true, title: true },
  });
  return row;
}

export async function forceCampaignLastMorningBoostId(campaignId: string, entryId: string): Promise<void> {
  await client().campaign.update({ where: { id: campaignId }, data: { lastMorningBoostId: entryId } });
}

export async function getRecurrenceRun(templateId: string): Promise<{ outcome: string; childCampaignId: string | null } | null> {
  const row = await client().recurrenceRun.findFirst({
    where: { templateId },
    orderBy: { createdAt: "desc" },
    select: { outcome: true, childCampaignId: true },
  });
  return row ?? null;
}

export async function countChildCampaigns(templateId: string): Promise<number> {
  return client().campaign.count({ where: { parentCampaignId: templateId } });
}

// At most one recurring template may exist per recurrenceSource (a partial
// unique index enforces this — see migration 20260914_recurring_source_singleton),
// so dispatch/duplicate-guard tests can no longer spin up a disposable
// second MORNING_BOOST template. They instead borrow the real singleton
// template for the duration of the test via these helpers: save its
// mutable fields, mutate them for the test, then restore afterward
// (always in a `finally` block — this is the live production sender).
export async function getMorningBoostTemplateId(): Promise<string> {
  const row = await client().campaign.findFirst({
    where: { isRecurring: true, recurrenceSource: "MORNING_BOOST" },
    select: { id: true },
  });
  if (!row) throw new Error("No MORNING_BOOST recurring template exists in this environment");
  return row.id;
}

interface CampaignMutableFields {
  recurrenceTime: string | null;
  audienceRules: unknown;
  lastMorningBoostId: string | null;
}

export async function getCampaignMutableFields(id: string): Promise<CampaignMutableFields> {
  const row = await client().campaign.findUniqueOrThrow({
    where: { id },
    select: { recurrenceTime: true, audienceRules: true, lastMorningBoostId: true },
  });
  return row as CampaignMutableFields;
}

export async function setCampaignMutableFields(id: string, fields: Partial<CampaignMutableFields>): Promise<void> {
  await client().campaign.update({ where: { id }, data: fields as never });
}

interface RecurrenceRunSnapshot {
  id: string;
  scheduledDate: Date;
  childCampaignId: string | null;
  outcome: string;
  createdAt: Date;
}

// Reads today's RecurrenceRun row for this template, if any, before a test
// touches it. The real 10:00 UTC dispatch runs against this same live
// singleton template every day, so a test that later wipes today's row
// unconditionally would be destroying the real production dispatch audit
// record/day-guard, not just its own test-created one. Paired with
// restoreRecurrenceRunForToday below.
export async function snapshotRecurrenceRunForToday(templateId: string): Promise<RecurrenceRunSnapshot | null> {
  const now = new Date();
  const scheduledDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const row = await client().recurrenceRun.findFirst({ where: { templateId, scheduledDate } });
  return row ?? null;
}

// Releases the day's dispatch slot claimed during a test run, then puts
// back whatever real RecurrenceRun row existed before the test started (if
// any), with the same id/scheduledDate/childCampaignId/outcome/createdAt —
// so the real production template isn't left blocked, and its real dispatch
// history for today isn't lost either. If no row existed before the test,
// nothing is recreated.
export async function restoreRecurrenceRunForToday(
  templateId: string,
  snapshot: RecurrenceRunSnapshot | null
): Promise<void> {
  const now = new Date();
  const scheduledDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  await client().recurrenceRun.deleteMany({ where: { templateId, scheduledDate } });
  if (!snapshot) return;
  await client().recurrenceRun.create({
    data: {
      id: snapshot.id,
      templateId,
      scheduledDate: snapshot.scheduledDate,
      childCampaignId: snapshot.childCampaignId,
      outcome: snapshot.outcome,
      createdAt: snapshot.createdAt,
    },
  });
}

export async function getCampaignById(id: string): Promise<{ subject: string; status: string; lastMorningBoostId: string | null } | null> {
  const row = await client().campaign.findUnique({
    where: { id },
    select: { subject: true, status: true, lastMorningBoostId: true },
  });
  return row ?? null;
}

// Directly inserts an EmailFailure row rather than triggering a real send
// failure — the admin dashboard's warning banner should be tested against
// its own detection/rendering logic, not against whatever the live SMTP
// provider's current health happens to be (which is exactly the kind of
// thing that's broken right now, but won't always be).
export async function createEmailFailure(to: string, subject: string, errorMessage: string): Promise<void> {
  await client().emailFailure.create({ data: { to, subject, errorMessage } });
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

// ── Affiliate program (SP-69/70/71) ──────────────────────────────────────────

export async function getApplicationByEmail(
  email: string,
  type: "PROVIDER" | "AMBASSADOR" | "AFFILIATE"
): Promise<{ id: string; status: string; userId: string | null; accountInviteToken: string | null } | null> {
  const row = await client().userApplication.findFirst({
    where: { email, type },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, userId: true, accountInviteToken: true },
  });
  return row ?? null;
}

// AffiliateAssignment.applicationId is unique, so this is a direct lookup —
// provisionAffiliate() (src/lib/affiliate.ts) is idempotent per application.
export async function getAffiliateAssignmentByApplicationId(
  applicationId: string
): Promise<{ id: string; userId: string; affiliateType: string; status: string } | null> {
  const row = await client().affiliateAssignment.findUnique({
    where: { applicationId },
    select: { id: true, userId: true, affiliateType: true, status: true },
  });
  return row ?? null;
}

export async function getContactByUserId(userId: string): Promise<{ id: string } | null> {
  const row = await client().contact.findUnique({ where: { userId }, select: { id: true } });
  return row ?? null;
}

// The "Affiliates" ContactList is admin-managed (src/lib/contacts.ts's
// ensureAffiliateListMembership) -- checks membership by list name rather
// than a hardcoded id since no e2e fixture pins one.
export async function isContactInNamedList(contactId: string, listName: string): Promise<boolean> {
  const list = await client().contactList.findFirst({
    where: { name: listName, ownerType: "FN_ADMIN" },
    select: { id: true },
  });
  if (!list) return false;
  const member = await client().contactListMember.findUnique({
    where: { listId_contactId: { listId: list.id, contactId } },
    select: { id: true },
  });
  return !!member;
}

export async function getConsentOptIn(contactId: string, topic: "MORNING_BOOST"): Promise<boolean | null> {
  const row = await client().contactConsent.findUnique({
    where: { contactId_topic: { contactId, topic } },
    select: { optedIn: true },
  });
  return row?.optedIn ?? null;
}

export async function getPromoCodeByCode(
  code: string
): Promise<{ id: string; affiliateId: string; stripeCouponId: string | null; usedCount: number; maxUses: number | null } | null> {
  const row = await client().promoCode.findUnique({
    where: { code },
    select: { id: true, affiliateId: true, stripeCouponId: true, usedCount: true, maxUses: true },
  });
  return row ?? null;
}

// Best-effort deep delete for an AffiliateAssignment created directly by a
// test (not through provisionAffiliate's normal application-approval path,
// or when a test wants to clean up before the global teardown sweep runs) --
// PromoCode/CommissionRule/CommissionLedger are all ON DELETE RESTRICT from
// AffiliateAssignment, so they must go first.
export async function deleteAffiliateAssignmentDeep(assignmentId: string): Promise<void> {
  const db_ = client();
  await db_.commissionLedger.deleteMany({ where: { affiliateId: assignmentId } });
  await db_.promoCode.deleteMany({ where: { affiliateId: assignmentId } });
  await db_.commissionRule.deleteMany({ where: { affiliateId: assignmentId } });
  await db_.affiliateAssignment.deleteMany({ where: { id: assignmentId } });
}

// A real, active Price with a live Stripe Price attached -- used by
// checkout-promo-code.spec.ts to hit /api/checkout/create-session the same
// way /join does, without hardcoding a price id that could go stale.
export async function getActivePriceId(): Promise<string | null> {
  const row = await client().price.findFirst({
    where: { active: true, stripePriceId: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return row?.id ?? null;
}

export async function closeTestDb(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
