/**
 * Manual smoke check for the Daily Positivity Boost selection algorithm --
 * not wired into CI, run by hand when touching src/lib/positivityBoost.ts.
 * npx tsx scripts/check-positivity-selection.ts
 *
 * This exercises what Playwright can't: concurrent first-request race
 * safety around the unique daily-assignment constraint. It does NOT touch
 * real content -- it creates its own throwaway fixture, checks behavior,
 * then deletes everything it made, including any assignment row for the
 * fixture's display date so it never lingers as fake history.
 */
import { PrismaClient } from "@prisma/client";
import { getTodaysPositivityBoost, getEtCalendarDate } from "../src/lib/positivityBoost";

const db = new PrismaClient();

async function main() {
  const fixtureContent = `QA e2e selection check fixture, run ${Date.now()}.`;
  const fixture = await db.positivityBoost.create({
    data: {
      content: fixtureContent,
      category: "Optimism",
      status: "ACTIVE",
      validationStatus: "PASSED",
    },
  });

  const displayDate = getEtCalendarDate();
  const preExisting = await db.positivityBoostAssignment.findUnique({ where: { displayDate } });

  try {
    // Fire several concurrent requests -- exactly one should win the create
    // race, all should resolve to the same content, none should throw.
    const results = await Promise.all(Array.from({ length: 8 }, () => getTodaysPositivityBoost()));
    const distinctContent = new Set(results.map((r) => r.content));

    if (distinctContent.size !== 1) {
      console.error("FAIL: concurrent requests returned different content:", [...distinctContent]);
      process.exitCode = 1;
    } else {
      console.log(`PASS: ${results.length} concurrent requests all resolved to the same content.`);
    }

    const assignmentCount = await db.positivityBoostAssignment.count({ where: { displayDate } });
    if (!preExisting && assignmentCount !== 1) {
      console.error(`FAIL: expected exactly 1 assignment row for today, found ${assignmentCount}.`);
      process.exitCode = 1;
    } else {
      console.log("PASS: exactly one assignment row exists for today's display date.");
    }
  } finally {
    // Clean up -- if today's assignment happens to point at our fixture
    // (only possible if there was no pre-existing real assignment), remove
    // it too so we don't leave fake history sitting in production.
    if (!preExisting) {
      await db.positivityBoostAssignment.deleteMany({ where: { displayDate, positivityBoostId: fixture.id } });
    }
    await db.positivityBoost.delete({ where: { id: fixture.id } });
    console.log("Cleaned up fixture content.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
