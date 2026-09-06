/**
 * Tune Your Brain — Positive Reframe initial content seed
 * npx tsx scripts/seed-tune-brain-positive-reframe.ts
 *
 * Idempotent: TbContentItem has no natural unique constraint on content, so
 * this upserts by finding an existing row for the same gameKey+prompt before
 * creating, matching seed-positivity-boosts.ts's idempotent idiom. Content
 * is authored and reviewed directly (no automated validator exists yet for
 * multi-option content -- that's Phase 4), so rows are seeded straight to
 * ACTIVE/PASSED.
 */
import { PrismaClient } from "@prisma/client"
import { POSITIVE_REFRAME_SCENARIOS } from "./tune-brain-positive-reframe-content"

const db = new PrismaClient()

type TbSeedDb = {
  tbContentItem: {
    findFirst: (args: { where: Record<string, unknown> }) => Promise<{ id: string } | null>
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>
  }
  tbContentItemOption: {
    createMany: (args: { data: Record<string, unknown>[] }) => Promise<unknown>
  }
}
const db_ = db as unknown as TbSeedDb

async function main() {
  let created = 0
  let skipped = 0

  for (const scenario of POSITIVE_REFRAME_SCENARIOS) {
    const existing = await db_.tbContentItem.findFirst({
      where: { gameKey: "POSITIVE_REFRAME", prompt: scenario.prompt },
    })
    if (existing) {
      skipped++
      continue
    }

    const item = await db_.tbContentItem.create({
      data: {
        gameKey: "POSITIVE_REFRAME",
        status: "ACTIVE",
        difficulty: scenario.difficulty,
        category: scenario.category,
        prompt: scenario.prompt,
        payload: {},
        validationStatus: "PASSED",
        validationNotes: "Authored and reviewed directly for the Phase 1 seed.",
      },
    })

    await db_.tbContentItemOption.createMany({
      data: scenario.options.map((opt, idx) => ({
        contentItemId: item.id,
        order: idx,
        label: opt.label,
        isCorrectOrBest: opt.isCorrectOrBest,
        explanation: opt.explanation ?? null,
      })),
    })

    created++
  }

  console.log(`Seeded Positive Reframe content: ${created} created, ${skipped} already existed.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
