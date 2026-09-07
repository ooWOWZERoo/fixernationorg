import { PrismaClient } from "@prisma/client";
import { TEST_CONTACT_EMAIL_OR, NAMED_FIXTURE_EMAILS, E2E_AUDIENCE_FIXTURE_DOMAIN } from "../../../src/lib/testContacts";

const QA_NAME = { contains: "QA", mode: "insensitive" as const };

type CleanupTask = { name: string; run: () => Promise<number> };

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
//
// Restructured 2026-09-07: this used to be ~25 sequential statements in one
// try/catch, so a single FK surprise on one model (e.g. Territory) silently
// aborted every unrelated model's cleanup that ran later in source order.
// Each model's cleanup is now an independent task run via Promise.allSettled
// — one task's failure can never block any other task from running, and
// failures are reported by name instead of vanishing.
export default async function globalTeardown() {
  const url = process.env.TEST_DATABASE_URL;
  const startedAtRaw = process.env.E2E_RUN_STARTED_AT;
  if (!url || !startedAtRaw) {
    console.error(
      "[global-teardown] SKIPPED — TEST_DATABASE_URL or E2E_RUN_STARTED_AT not set, no cleanup ran this invocation",
      { hasUrl: Boolean(url), hasStartedAt: Boolean(startedAtRaw) }
    );
    return;
  }

  const startedAt = new Date(startedAtRaw);
  const db = new PrismaClient({ datasources: { db: { url } } });

  const tasks: CleanupTask[] = [
    {
      name: "contacts",
      run: async () =>
        (
          await db.contact.deleteMany({
            where: {
              createdAt: { gte: startedAt },
              OR: [...TEST_CONTACT_EMAIL_OR, { email: { endsWith: `@${E2E_AUDIENCE_FIXTURE_DOMAIN}` } }],
            },
          })
        ).count,
    },
    {
      name: "applications",
      run: async () => {
        const qaApps = await db.userApplication.findMany({
          where: { createdAt: { gte: startedAt }, OR: TEST_CONTACT_EMAIL_OR },
          select: { id: true },
        });
        const qaAppIds = qaApps.map((a) => a.id);
        // TerritoryAssignment has no cascade from UserApplication -- must go first.
        await db.territoryAssignment.deleteMany({ where: { applicationId: { in: qaAppIds } } });
        // OnboardingRecord/ChecklistItem are ON DELETE RESTRICT from UserApplication -- must go first too.
        await db.onboardingRecord.deleteMany({ where: { applicationId: { in: qaAppIds } } });
        await db.checklistItem.deleteMany({ where: { applicationId: { in: qaAppIds } } });
        return (await db.userApplication.deleteMany({ where: { id: { in: qaAppIds } } })).count;
      },
    },
    {
      name: "campaigns",
      run: async () =>
        (
          await db.campaign.deleteMany({
            where: { createdAt: { gte: startedAt }, name: QA_NAME },
          })
        ).count,
    },
    {
      // Challenge/GrowthPathway enrollments have no onDelete from their
      // content side (Restrict) -- delete enrollments referencing this run's
      // QA content before the content itself.
      name: "challenges",
      run: async () => {
        const qaChallenges = await db.challenge.findMany({ where: { createdAt: { gte: startedAt }, title: QA_NAME }, select: { id: true } });
        const qaChallengeIds = qaChallenges.map((c) => c.id);
        await db.challengeEnrollment.deleteMany({ where: { challengeId: { in: qaChallengeIds } } });
        return (await db.challenge.deleteMany({ where: { id: { in: qaChallengeIds } } })).count;
      },
    },
    {
      name: "pathways",
      run: async () => {
        const qaPathways = await db.growthPathway.findMany({ where: { createdAt: { gte: startedAt }, title: QA_NAME }, select: { id: true } });
        const qaPathwayIds = qaPathways.map((p) => p.id);
        await db.pathwayEnrollment.deleteMany({ where: { pathwayId: { in: qaPathwayIds } } });
        return (await db.growthPathway.deleteMany({ where: { id: { in: qaPathwayIds } } })).count;
      },
    },
    {
      name: "automationJourneys",
      run: async () =>
        (
          await db.automationJourney.deleteMany({
            where: { createdAt: { gte: startedAt }, name: QA_NAME },
          })
        ).count,
    },
    {
      // TerritoryAssignment.territoryId is ON DELETE RESTRICT from Territory
      // -- must go first, even for assignments that are already REVOKED.
      name: "territories",
      run: async () => {
        const qaTerritories = await db.territory.findMany({ where: { createdAt: { gte: startedAt }, name: QA_NAME }, select: { id: true } });
        const qaTerritoryIds = qaTerritories.map((t) => t.id);
        await db.territoryAssignment.deleteMany({ where: { territoryId: { in: qaTerritoryIds } } });
        return (await db.territory.deleteMany({ where: { id: { in: qaTerritoryIds } } })).count;
      },
    },
    {
      name: "contactLists",
      run: async () =>
        (
          await db.contactList.deleteMany({
            where: { createdAt: { gte: startedAt }, name: QA_NAME },
          })
        ).count,
    },
    {
      name: "emailTemplates",
      run: async () =>
        (
          await db.emailTemplate.deleteMany({
            where: { createdAt: { gte: startedAt }, name: QA_NAME },
          })
        ).count,
    },
    {
      name: "events",
      run: async () =>
        (
          await db.event.deleteMany({
            where: { createdAt: { gte: startedAt }, title: QA_NAME },
          })
        ).count,
    },
    {
      // Not FK-referenced (Campaign.lastMorningBoostId is a plain string, no
      // relation) -- safe to delete directly. Missed in the original
      // full-schema audit; caught 2026-09-06 when a same-night sweep found 12
      // leftover "QA e2e boost..." rows from admin-recurring-campaigns.spec.ts.
      name: "morningBoosts",
      run: async () =>
        (
          await db.morningBoost.deleteMany({
            where: { createdAt: { gte: startedAt }, title: QA_NAME },
          })
        ).count,
    },
    {
      name: "mediaAssets",
      run: async () =>
        (
          await db.mediaAsset.deleteMany({
            where: { createdAt: { gte: startedAt }, name: { contains: "qa-e2e", mode: "insensitive" } },
          })
        ).count,
    },
    {
      name: "savedSections",
      run: async () =>
        (
          await db.savedSection.deleteMany({
            where: { createdAt: { gte: startedAt }, name: QA_NAME },
          })
        ).count,
    },
    {
      name: "socialProfiles",
      run: async () =>
        (
          await db.socialProfile.deleteMany({
            where: { createdAt: { gte: startedAt }, headline: QA_NAME },
          })
        ).count,
    },
    {
      name: "importBatches",
      run: async () =>
        (
          await db.contactImportBatch.deleteMany({
            where: { importedAt: { gte: startedAt }, filename: { contains: "qa-e2e", mode: "insensitive" } },
          })
        ).count,
    },
    {
      name: "contactActivities",
      run: async () =>
        (
          await db.contactActivity.deleteMany({
            where: { occurredAt: { gte: startedAt }, summary: { contains: "qa-", mode: "insensitive" } },
          })
        ).count,
    },
    {
      // No timestamp on ContactTag -- pattern-only match, safe since a real
      // tag would never look like an e2e-generated one.
      name: "contactTags",
      run: async () =>
        (
          await db.contactTag.deleteMany({
            where: { tag: { contains: "qa-", mode: "insensitive" } },
          })
        ).count,
    },
    {
      name: "emailFailures",
      run: async () =>
        (
          await db.emailFailure.deleteMany({
            where: {
              occurredAt: { gte: startedAt },
              OR: [
                { to: { contains: "@example.com" } },
                { to: { contains: "@fixernation-e2e.test" } },
                { subject: QA_NAME },
              ],
            },
          })
        ).count,
    },
    // Side-content generated by tests running as the persistent named
    // fixtures (gift codes, promo codes, commission ledger entries) --
    // these accounts must stay, but what they accumulate during a run
    // shouldn't.
    {
      name: "giftCodes",
      run: async () => {
        const namedFixtures = await db.user.findMany({
          where: { email: { in: NAMED_FIXTURE_EMAILS } },
          select: { id: true },
        });
        const namedFixtureIds = namedFixtures.map((u) => u.id);
        return (
          await db.giftCode.deleteMany({
            where: { createdAt: { gte: startedAt }, redeemedByUserId: { in: namedFixtureIds } },
          })
        ).count;
      },
    },
    {
      name: "promoCodes",
      run: async () => {
        const namedFixtures = await db.user.findMany({
          where: { email: { in: NAMED_FIXTURE_EMAILS } },
          select: { id: true },
        });
        const namedFixtureIds = namedFixtures.map((u) => u.id);
        const affiliateAssignments = await db.affiliateAssignment.findMany({
          where: { userId: { in: namedFixtureIds } },
          select: { id: true },
        });
        const affiliateIds = affiliateAssignments.map((a) => a.id);
        return (
          await db.promoCode.deleteMany({
            where: { createdAt: { gte: startedAt }, affiliateId: { in: affiliateIds } },
          })
        ).count;
      },
    },
    {
      name: "commissionLedger",
      run: async () => {
        const namedFixtures = await db.user.findMany({
          where: { email: { in: NAMED_FIXTURE_EMAILS } },
          select: { id: true },
        });
        const namedFixtureIds = namedFixtures.map((u) => u.id);
        const affiliateAssignments = await db.affiliateAssignment.findMany({
          where: { userId: { in: namedFixtureIds } },
          select: { id: true },
        });
        const affiliateIds = affiliateAssignments.map((a) => a.id);
        return (
          await db.commissionLedger.deleteMany({
            where: { createdAt: { gte: startedAt }, affiliateId: { in: affiliateIds } },
          })
        ).count;
      },
    },
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
    {
      name: "tbGameSessions",
      run: async () => {
        const namedFixtures = await db.user.findMany({ where: { email: { in: NAMED_FIXTURE_EMAILS } }, select: { id: true } });
        const namedFixtureIds = namedFixtures.map((u) => u.id);
        return (await db.tbGameSession.deleteMany({ where: { userId: { in: namedFixtureIds } } })).count;
      },
    },
    {
      name: "tbGameLevels",
      run: async () => {
        const namedFixtures = await db.user.findMany({ where: { email: { in: NAMED_FIXTURE_EMAILS } }, select: { id: true } });
        const namedFixtureIds = namedFixtures.map((u) => u.id);
        return (await db.tbGameLevel.deleteMany({ where: { userId: { in: namedFixtureIds } } })).count;
      },
    },
    {
      name: "tbStreaks",
      run: async () => {
        const namedFixtures = await db.user.findMany({ where: { email: { in: NAMED_FIXTURE_EMAILS } }, select: { id: true } });
        const namedFixtureIds = namedFixtures.map((u) => u.id);
        return (await db.streak.deleteMany({ where: { userId: { in: namedFixtureIds } } })).count;
      },
    },
    {
      name: "tbUserBadges",
      run: async () => {
        const namedFixtures = await db.user.findMany({ where: { email: { in: NAMED_FIXTURE_EMAILS } }, select: { id: true } });
        const namedFixtureIds = namedFixtures.map((u) => u.id);
        return (await db.tbUserBadge.deleteMany({ where: { userId: { in: namedFixtureIds } } })).count;
      },
    },
    {
      name: "tbBadgeFeatures",
      run: async () => {
        const namedFixtures = await db.user.findMany({ where: { email: { in: NAMED_FIXTURE_EMAILS } }, select: { id: true } });
        const namedFixtureIds = namedFixtures.map((u) => u.id);
        return (await db.badgeFeature.deleteMany({ where: { userId: { in: namedFixtureIds } } })).count;
      },
    },
    {
      name: "tbGoals",
      run: async () => {
        const namedFixtures = await db.user.findMany({ where: { email: { in: NAMED_FIXTURE_EMAILS } }, select: { id: true } });
        const namedFixtureIds = namedFixtures.map((u) => u.id);
        return (await db.tbGoal.deleteMany({ where: { userId: { in: namedFixtureIds } } })).count;
      },
    },
    {
      name: "tbNotifications",
      run: async () => {
        const namedFixtures = await db.user.findMany({ where: { email: { in: NAMED_FIXTURE_EMAILS } }, select: { id: true } });
        const namedFixtureIds = namedFixtures.map((u) => u.id);
        return (await db.notification.deleteMany({ where: { createdAt: { gte: startedAt }, userId: { in: namedFixtureIds } } })).count;
      },
    },
    // Models found polluted in the 2026-09-06/07 production sweep that this
    // file never covered before. SocialGroup's Post/GroupMember/GroupRequest
    // all carry onDelete: Cascade in the schema, so no pre-clean is needed
    // there. ProviderCampaign's sends cascade the same way. FixerPlan's
    // items cascade and its actions (MemberAction.planId) are ON DELETE SET
    // NULL, so neither needs a pre-clean either.
    {
      name: "contactMessages",
      run: async () =>
        (
          await db.contactMessage.deleteMany({
            where: { createdAt: { gte: startedAt }, OR: [{ name: QA_NAME }, { email: QA_NAME }, { message: QA_NAME }] },
          })
        ).count,
    },
    {
      name: "socialGroups",
      run: async () =>
        (
          await db.socialGroup.deleteMany({
            where: { createdAt: { gte: startedAt }, name: QA_NAME },
          })
        ).count,
    },
    {
      name: "providerCampaigns",
      run: async () =>
        (
          await db.providerCampaign.deleteMany({
            where: { createdAt: { gte: startedAt }, name: QA_NAME },
          })
        ).count,
    },
    {
      // SuppressionRecord's timestamp field is suppressedAt, not createdAt.
      name: "suppressionRecords",
      run: async () =>
        (
          await db.suppressionRecord.deleteMany({
            where: { suppressedAt: { gte: startedAt }, OR: [{ email: QA_NAME }, { reason: QA_NAME }] },
          })
        ).count,
    },
    {
      name: "fixerQuestions",
      run: async () =>
        (
          await db.fixerQuestion.deleteMany({
            where: { createdAt: { gte: startedAt }, name: QA_NAME },
          })
        ).count,
    },
    {
      name: "directMessages",
      run: async () =>
        (
          await db.directMessage.deleteMany({
            where: { createdAt: { gte: startedAt }, body: QA_NAME },
          })
        ).count,
    },
    {
      name: "fixerPlans",
      run: async () =>
        (
          await db.fixerPlan.deleteMany({
            where: { createdAt: { gte: startedAt }, title: QA_NAME },
          })
        ).count,
    },
    {
      name: "memberRecognitions",
      run: async () =>
        (
          await db.memberRecognition.deleteMany({
            where: { createdAt: { gte: startedAt }, message: QA_NAME },
          })
        ).count,
    },
  ];

  try {
    const results = await Promise.allSettled(tasks.map((t) => t.run()));

    const counts: Record<string, number> = {};
    const failures: Record<string, string> = {};
    results.forEach((r, i) => {
      const name = tasks[i].name;
      if (r.status === "fulfilled") counts[name] = r.value;
      else failures[name] = r.reason instanceof Error ? r.reason.message : String(r.reason);
    });

    console.log(`[global-teardown] cleaned up rows created since ${startedAt.toISOString()}:`, JSON.stringify(counts));
    if (Object.keys(failures).length > 0) {
      console.error(`[global-teardown] FAILED to clean up ${Object.keys(failures).length} model(s):`, JSON.stringify(failures));
    }
  } finally {
    await db.$disconnect();
  }
}
