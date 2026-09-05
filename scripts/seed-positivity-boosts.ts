/**
 * Your Daily Positivity Boost — initial content library seed
 * npx tsx scripts/seed-positivity-boosts.ts
 *
 * Idempotent: upserts on content's unique constraint, safe to re-run.
 * Still runs the real validator per message rather than forcing ACTIVE, so
 * a seed-content mistake surfaces as REJECTED in the admin list instead of
 * silently going live.
 */
import { PrismaClient } from "@prisma/client";
import { validatePositivityBoost } from "../src/lib/positivityValidator";
import { POSITIVITY_MESSAGES } from "./positivity-boost-content";

const db = new PrismaClient();

async function main() {
  let created = 0;
  let rejected = 0;

  for (const msg of POSITIVITY_MESSAGES) {
    const result = validatePositivityBoost(msg.content);
    if (!result.passed) rejected++;
    else created++;

    await db.positivityBoost.upsert({
      where: { content: msg.content },
      create: {
        content: msg.content,
        category: msg.category,
        isFallback: msg.isFallback ?? false,
        status: result.passed ? "ACTIVE" : "REJECTED",
        validationStatus: result.passed ? "PASSED" : "FAILED",
        validationNotes: result.notes.join("; ") || null,
        approvedAt: result.passed ? new Date() : null,
      },
      update: {},
    });
  }

  console.log(`Seeded ${POSITIVITY_MESSAGES.length} positivity boosts (${created} ACTIVE, ${rejected} REJECTED).`);
  if (rejected > 0) {
    console.warn(`${rejected} seed message(s) failed validation — check the admin list before relying on this batch.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
