import { PrismaClient } from "@prisma/client";
import { TEST_CONTACT_EMAIL_OR } from "../../../src/lib/testContacts";

// Deletes every Contact/UserApplication/Campaign the just-finished run
// created that matches the QA/test email pattern (see global-setup.ts for
// the run-start marker). Runs unconditionally after the suite, pass or
// fail, so a spec forgetting its own cleanup can no longer leave permanent
// junk in production -- see the 2026-09-05 incident where ~1900 leftover
// rows from unattended e2e runs polluted real campaign audiences.
export default async function globalTeardown() {
  const url = process.env.TEST_DATABASE_URL;
  const startedAtRaw = process.env.E2E_RUN_STARTED_AT;
  if (!url || !startedAtRaw) return;

  const startedAt = new Date(startedAtRaw);
  const db = new PrismaClient({ datasources: { db: { url } } });

  try {
    const contactDel = await db.contact.deleteMany({
      where: { createdAt: { gte: startedAt }, OR: TEST_CONTACT_EMAIL_OR },
    });

    const qaApps = await db.userApplication.findMany({
      where: { createdAt: { gte: startedAt }, OR: TEST_CONTACT_EMAIL_OR },
      select: { id: true },
    });
    const qaAppIds = qaApps.map((a) => a.id);
    // TerritoryAssignment has no cascade from UserApplication -- must go first.
    await db.territoryAssignment.deleteMany({ where: { applicationId: { in: qaAppIds } } });
    const appDel = await db.userApplication.deleteMany({ where: { id: { in: qaAppIds } } });

    const campDel = await db.campaign.deleteMany({
      where: { createdAt: { gte: startedAt }, name: { contains: "QA", mode: "insensitive" } },
    });

    console.log(
      `[global-teardown] removed ${contactDel.count} contact(s), ${appDel.count} application(s), ${campDel.count} campaign(s) created since ${startedAt.toISOString()}`
    );
  } catch (err) {
    // Cleanup is best-effort -- never fail the run over it.
    console.error("[global-teardown] cleanup failed (non-fatal):", err);
  } finally {
    await db.$disconnect();
  }
}
