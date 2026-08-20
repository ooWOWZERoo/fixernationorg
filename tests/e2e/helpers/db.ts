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

export async function closeTestDb(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
