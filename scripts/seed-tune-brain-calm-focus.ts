/**
 * Tune Your Brain — Calm & Focus initial content seed
 * npx dotenv -e .env.neon.local -- npx tsx scripts/seed-tune-brain-calm-focus.ts
 *
 * Idempotent: upserts by finding an existing row for the same
 * gameKey+category before creating (this game's rows are one-per-mode,
 * so category is the natural dedupe key rather than prompt text).
 */
import { PrismaClient, type Prisma } from "@prisma/client"
import { CALM_FOCUS_MODES } from "./tune-brain-calm-focus-content"

const db = new PrismaClient()

async function main() {
  let created = 0
  let skipped = 0

  for (const mode of CALM_FOCUS_MODES) {
    const existing = await db.tbContentItem.findFirst({
      where: { gameKey: "CALM_FOCUS", category: mode.category },
    })
    if (existing) {
      skipped++
      continue
    }

    await db.tbContentItem.create({
      data: {
        gameKey: "CALM_FOCUS",
        status: "ACTIVE",
        category: mode.category,
        prompt: mode.prompt,
        payload: mode.payload as unknown as Prisma.InputJsonValue,
        validationStatus: "PASSED",
        validationNotes: "Authored and reviewed directly for the Phase 3 seed.",
      },
    })

    created++
  }

  console.log(`Seeded Calm & Focus content: ${created} created, ${skipped} already existed.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
