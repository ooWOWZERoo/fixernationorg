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

export async function closeTestDb(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
