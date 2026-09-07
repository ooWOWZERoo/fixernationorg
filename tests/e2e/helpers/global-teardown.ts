import { PrismaClient } from "@prisma/client";
import { TEST_CONTACT_EMAIL_OR, NAMED_FIXTURE_EMAILS, E2E_AUDIENCE_FIXTURE_DOMAIN } from "../../../src/lib/testContacts";

const QA_NAME = { contains: "QA", mode: "insensitive" as const };

// Deletes everything the just-finished run created that matches a QA/test
// pattern (see global-setup.ts for the run-start marker). Runs
// unconditionally after the suite, pass or fail, so a spec forgetting its
// own cleanup can no longer leave permanent junk in production.
//
// Started 2026-09-05 covering Contact/UserApplication/Campaign only, after
// ~1900 leftover rows polluted real campaign audiences. Extended
// 2026-09-06 after a full-schema audit found the same problem in ~15 more
// models (Territory, AutomationJourney, Challenge, GrowthPathway, and
// others) that individual specs never clean up after themselves — same
// root cause, just not scoped the first time.
export default async function globalTeardown() {
  const url = process.env.TEST_DATABASE_URL;
  const startedAtRaw = process.env.E2E_RUN_STARTED_AT;
  if (!url || !startedAtRaw) return;

  const startedAt = new Date(startedAtRaw);
  const db = new PrismaClient({ datasources: { db: { url } } });
  const counts: Record<string, number> = {};

  try {
    const contactDel = await db.contact.deleteMany({
      where: {
        createdAt: { gte: startedAt },
        OR: [...TEST_CONTACT_EMAIL_OR, { email: { endsWith: `@${E2E_AUDIENCE_FIXTURE_DOMAIN}` } }],
      },
    });
    counts.contacts = contactDel.count;

    const qaApps = await db.userApplication.findMany({
      where: { createdAt: { gte: startedAt }, OR: TEST_CONTACT_EMAIL_OR },
      select: { id: true },
    });
    const qaAppIds = qaApps.map((a) => a.id);
    // TerritoryAssignment has no cascade from UserApplication -- must go first.
    await db.territoryAssignment.deleteMany({ where: { applicationId: { in: qaAppIds } } });
    counts.applications = (await db.userApplication.deleteMany({ where: { id: { in: qaAppIds } } })).count;

    counts.campaigns = (await db.campaign.deleteMany({
      where: { createdAt: { gte: startedAt }, name: QA_NAME },
    })).count;

    // Challenge/GrowthPathway enrollments have no onDelete from their
    // content side (Restrict) -- delete enrollments referencing this run's
    // QA content before the content itself.
    const qaChallenges = await db.challenge.findMany({ where: { createdAt: { gte: startedAt }, title: QA_NAME }, select: { id: true } });
    const qaChallengeIds = qaChallenges.map((c) => c.id);
    await db.challengeEnrollment.deleteMany({ where: { challengeId: { in: qaChallengeIds } } });
    counts.challenges = (await db.challenge.deleteMany({ where: { id: { in: qaChallengeIds } } })).count;

    const qaPathways = await db.growthPathway.findMany({ where: { createdAt: { gte: startedAt }, title: QA_NAME }, select: { id: true } });
    const qaPathwayIds = qaPathways.map((p) => p.id);
    await db.pathwayEnrollment.deleteMany({ where: { pathwayId: { in: qaPathwayIds } } });
    counts.pathways = (await db.growthPathway.deleteMany({ where: { id: { in: qaPathwayIds } } })).count;

    counts.automationJourneys = (await db.automationJourney.deleteMany({
      where: { createdAt: { gte: startedAt }, name: QA_NAME },
    })).count;

    counts.territories = (await db.territory.deleteMany({
      where: { createdAt: { gte: startedAt }, name: QA_NAME },
    })).count;

    counts.contactLists = (await db.contactList.deleteMany({
      where: { createdAt: { gte: startedAt }, name: QA_NAME },
    })).count;

    counts.emailTemplates = (await db.emailTemplate.deleteMany({
      where: { createdAt: { gte: startedAt }, name: QA_NAME },
    })).count;

    counts.events = (await db.event.deleteMany({
      where: { createdAt: { gte: startedAt }, title: QA_NAME },
    })).count;

    // Not FK-referenced (Campaign.lastMorningBoostId is a plain string, no
    // relation) -- safe to delete directly. Missed in the original
    // full-schema audit; caught 2026-09-06 when a same-night sweep found 12
    // leftover "QA e2e boost..." rows from admin-recurring-campaigns.spec.ts.
    counts.morningBoosts = (await db.morningBoost.deleteMany({
      where: { createdAt: { gte: startedAt }, title: QA_NAME },
    })).count;

    counts.mediaAssets = (await db.mediaAsset.deleteMany({
      where: { createdAt: { gte: startedAt }, name: { contains: "qa-e2e", mode: "insensitive" } },
    })).count;

    counts.savedSections = (await db.savedSection.deleteMany({
      where: { createdAt: { gte: startedAt }, name: QA_NAME },
    })).count;

    counts.socialProfiles = (await db.socialProfile.deleteMany({
      where: { createdAt: { gte: startedAt }, headline: QA_NAME },
    })).count;

    counts.importBatches = (await db.contactImportBatch.deleteMany({
      where: { importedAt: { gte: startedAt }, filename: { contains: "qa-e2e", mode: "insensitive" } },
    })).count;

    counts.contactActivities = (await db.contactActivity.deleteMany({
      where: { occurredAt: { gte: startedAt }, summary: { contains: "qa-", mode: "insensitive" } },
    })).count;

    // No timestamp on ContactTag -- pattern-only match, safe since a real
    // tag would never look like an e2e-generated one.
    counts.contactTags = (await db.contactTag.deleteMany({
      where: { tag: { contains: "qa-", mode: "insensitive" } },
    })).count;

    counts.emailFailures = (await db.emailFailure.deleteMany({
      where: {
        occurredAt: { gte: startedAt },
        OR: [
          { to: { contains: "@example.com" } },
          { to: { contains: "@fixernation-e2e.test" } },
          { subject: QA_NAME },
        ],
      },
    })).count;

    // Side-content generated by tests running as the persistent named
    // fixtures (gift codes, promo codes, commission ledger entries) --
    // these accounts must stay, but what they accumulate during a run
    // shouldn't.
    const namedFixtures = await db.user.findMany({
      where: { email: { in: NAMED_FIXTURE_EMAILS } },
      select: { id: true },
    });
    const namedFixtureIds = namedFixtures.map((u) => u.id);

    counts.giftCodes = (await db.giftCode.deleteMany({
      where: { createdAt: { gte: startedAt }, redeemedByUserId: { in: namedFixtureIds } },
    })).count;

    const affiliateAssignments = await db.affiliateAssignment.findMany({
      where: { userId: { in: namedFixtureIds } },
      select: { id: true },
    });
    const affiliateIds = affiliateAssignments.map((a) => a.id);
    counts.promoCodes = (await db.promoCode.deleteMany({
      where: { createdAt: { gte: startedAt }, affiliateId: { in: affiliateIds } },
    })).count;
    counts.commissionLedger = (await db.commissionLedger.deleteMany({
      where: { createdAt: { gte: startedAt }, affiliateId: { in: affiliateIds } },
    })).count;

    // Tune Your Brain (added 2026-09-07, Phase 7) -- same root cause as
    // giftCodes/promoCodes above: named fixtures accumulate real gameplay
    // rows every time an e2e spec plays a game as qa-member/qa-admin/etc.
    // No real production account is ever a qa-* fixture, so unlike the
    // createdAt-scoped deletes above, it's safe to clear ALL of a named
    // fixture's TB progression unconditionally rather than only this run's
    // slice -- there is no legitimate reason for these accounts to carry
    // real progress forward between runs. TbGameSession's cascade
    // (onDelete: Cascade on the TbGameSession relation) takes
    // TbGratitudeEntry/TbKindnessMission with it.
    counts.tbGameSessions = (await db.tbGameSession.deleteMany({
      where: { userId: { in: namedFixtureIds } },
    })).count;
    counts.tbGameLevels = (await db.tbGameLevel.deleteMany({
      where: { userId: { in: namedFixtureIds } },
    })).count;
    counts.tbStreaks = (await db.streak.deleteMany({
      where: { userId: { in: namedFixtureIds } },
    })).count;
    counts.tbUserBadges = (await db.tbUserBadge.deleteMany({
      where: { userId: { in: namedFixtureIds } },
    })).count;
    counts.tbBadgeFeatures = (await db.badgeFeature.deleteMany({
      where: { userId: { in: namedFixtureIds } },
    })).count;
    counts.tbGoals = (await db.tbGoal.deleteMany({
      where: { userId: { in: namedFixtureIds } },
    })).count;
    counts.tbNotifications = (await db.notification.deleteMany({
      where: { createdAt: { gte: startedAt }, userId: { in: namedFixtureIds } },
    })).count;

    console.log(
      `[global-teardown] cleaned up rows created since ${startedAt.toISOString()}:`,
      JSON.stringify(counts)
    );
  } catch (err) {
    // Cleanup is best-effort -- never fail the run over it.
    console.error("[global-teardown] cleanup failed (non-fatal):", err);
  } finally {
    await db.$disconnect();
  }
}
