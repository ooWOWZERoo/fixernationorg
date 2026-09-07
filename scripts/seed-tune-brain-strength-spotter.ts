/**
 * Tune Your Brain — Strength Spotter initial content seed
 * npx dotenv -e .env.neon.local -- npx tsx scripts/seed-tune-brain-strength-spotter.ts
 *
 * Idempotent, mirrors seed-tune-brain-positive-reframe.ts's idiom exactly.
 */
import { PrismaClient } from "@prisma/client"
import { STRENGTH_SPOTTER_SCENARIOS } from "./tune-brain-strength-spotter-content"

const db = new PrismaClient()

async function main() {
  let created = 0
  let skipped = 0

  for (const scenario of STRENGTH_SPOTTER_SCENARIOS) {
    const existing = await db.tbContentItem.findFirst({
      where: { gameKey: "STRENGTH_SPOTTER", prompt: scenario.prompt },
    })
    if (existing) {
      skipped++
      continue
    }

    const item = await db.tbContentItem.create({
      data: {
        gameKey: "STRENGTH_SPOTTER",
        status: "ACTIVE",
        difficulty: scenario.difficulty,
        category: scenario.category,
        prompt: scenario.prompt,
        payload: {},
        validationStatus: "PASSED",
        validationNotes: "Authored and reviewed directly for the Phase 3 seed.",
      },
    })

    await db.tbContentItemOption.createMany({
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

  console.log(`Seeded Strength Spotter content: ${created} created, ${skipped} already existed.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
