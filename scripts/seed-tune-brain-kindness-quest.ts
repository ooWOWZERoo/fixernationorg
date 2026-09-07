/**
 * Tune Your Brain — Kindness Quest initial content seed
 * npx dotenv -e .env.neon.local -- npx tsx scripts/seed-tune-brain-kindness-quest.ts
 *
 * Idempotent: upserts by finding an existing row for the same
 * gameKey+prompt before creating. No TbContentItemOption rows -- missions
 * are accept/complete, not multiple-choice.
 */
import { PrismaClient } from "@prisma/client"
import { KINDNESS_QUEST_MISSIONS } from "./tune-brain-kindness-quest-content"

const db = new PrismaClient()

async function main() {
  let created = 0
  let skipped = 0

  for (const m of KINDNESS_QUEST_MISSIONS) {
    const existing = await db.tbContentItem.findFirst({
      where: { gameKey: "KINDNESS_QUEST", prompt: m.prompt },
    })
    if (existing) {
      skipped++
      continue
    }

    await db.tbContentItem.create({
      data: {
        gameKey: "KINDNESS_QUEST",
        status: "ACTIVE",
        prompt: m.prompt,
        payload: {},
        validationStatus: "PASSED",
        validationNotes: "Authored and reviewed directly for the Phase 3 seed.",
      },
    })

    created++
  }

  console.log(`Seeded Kindness Quest content: ${created} created, ${skipped} already existed.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
