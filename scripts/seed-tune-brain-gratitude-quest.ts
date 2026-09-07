/**
 * Tune Your Brain — Gratitude Quest initial content seed
 * npx dotenv -e .env.neon.local -- npx tsx scripts/seed-tune-brain-gratitude-quest.ts
 *
 * Idempotent: upserts by finding an existing row for the same
 * gameKey+prompt before creating, matching seed-tune-brain-positive-reframe.ts's
 * idiom. No TbContentItemOption rows -- this game has no correct-answer
 * concept, just a private free-text response.
 */
import { PrismaClient } from "@prisma/client"
import { GRATITUDE_QUEST_PROMPTS } from "./tune-brain-gratitude-quest-content"

const db = new PrismaClient()

async function main() {
  let created = 0
  let skipped = 0

  for (const p of GRATITUDE_QUEST_PROMPTS) {
    const existing = await db.tbContentItem.findFirst({
      where: { gameKey: "GRATITUDE_QUEST", prompt: p.prompt },
    })
    if (existing) {
      skipped++
      continue
    }

    await db.tbContentItem.create({
      data: {
        gameKey: "GRATITUDE_QUEST",
        status: "ACTIVE",
        category: p.category,
        prompt: p.prompt,
        payload: {},
        validationStatus: "PASSED",
        validationNotes: "Authored and reviewed directly for the Phase 3 seed.",
      },
    })

    created++
  }

  console.log(`Seeded Gratitude Quest content: ${created} created, ${skipped} already existed.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
