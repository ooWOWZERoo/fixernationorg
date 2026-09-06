/**
 * Tune Your Brain — Phase 2 badge seed: the 7 Positive Reframe tier badges
 * plus the one cross-game "first activity" badge.
 * npx dotenv -e .env.neon.local -- npx tsx scripts/seed-tune-brain-badges.ts
 *
 * Idempotent: TbBadge.key is unique, so this upserts by key -- safe to
 * re-run any time copy changes, mirroring seed-positivity-boosts.ts's
 * idempotent idiom.
 */
import { PrismaClient, type TbGameKey, type TbLevelTier } from "@prisma/client"

const db = new PrismaClient()

interface BadgeSeed {
  key: string
  gameKey: TbGameKey | null
  name: string
  description: string
  tier: TbLevelTier | null
  iconKey: string
  sortOrder: number
  pointsReward: number
}

const BADGES: BadgeSeed[] = [
  {
    key: "getting_tuned",
    gameKey: null,
    name: "Getting Tuned",
    description: "Complete your first Tune Your Brain activity.",
    tier: null,
    iconKey: "spark",
    sortOrder: 0,
    pointsReward: 10,
  },
  {
    key: "reframe_starter",
    gameKey: "POSITIVE_REFRAME",
    name: "Fresh Perspective",
    description: "You played your first round of Positive Reframe -- welcome to a steadier way of looking at things.",
    tier: "STARTER",
    iconKey: "reframe-1",
    sortOrder: 1,
    pointsReward: 10,
  },
  {
    key: "reframe_explorer",
    gameKey: "POSITIVE_REFRAME",
    name: "Reframe Rookie",
    description: "You're building a habit of catching the upside -- nice work staying with it.",
    tier: "EXPLORER",
    iconKey: "reframe-2",
    sortOrder: 2,
    pointsReward: 15,
  },
  {
    key: "reframe_builder",
    gameKey: "POSITIVE_REFRAME",
    name: "Perspective Builder",
    description: "Your reframing skills are taking real shape.",
    tier: "BUILDER",
    iconKey: "reframe-3",
    sortOrder: 3,
    pointsReward: 20,
  },
  {
    key: "reframe_challenger",
    gameKey: "POSITIVE_REFRAME",
    name: "Resilience Builder",
    description: "You keep meeting setbacks with a clearer head -- that's resilience in action.",
    tier: "CHALLENGER",
    iconKey: "reframe-4",
    sortOrder: 4,
    pointsReward: 25,
  },
  {
    key: "reframe_skilled",
    gameKey: "POSITIVE_REFRAME",
    name: "Silver Lining",
    description: "Finding the silver lining is starting to feel natural for you.",
    tier: "SKILLED",
    iconKey: "reframe-5",
    sortOrder: 5,
    pointsReward: 30,
  },
  {
    key: "reframe_advanced",
    gameKey: "POSITIVE_REFRAME",
    name: "Perspective Pro",
    description: "You've got a sharp eye for the brighter side of a tough moment.",
    tier: "ADVANCED",
    iconKey: "reframe-6",
    sortOrder: 6,
    pointsReward: 40,
  },
  {
    key: "reframe_champion",
    gameKey: "POSITIVE_REFRAME",
    name: "Reframe Champion",
    description: "You've mastered the art of the reframe -- a genuinely impressive habit to have built.",
    tier: "CHAMPION",
    iconKey: "reframe-7",
    sortOrder: 7,
    pointsReward: 50,
  },
]

async function main() {
  let created = 0
  let updated = 0

  for (const b of BADGES) {
    const existing = await db.tbBadge.findUnique({ where: { key: b.key } })
    await db.tbBadge.upsert({
      where: { key: b.key },
      create: {
        key: b.key,
        gameKey: b.gameKey,
        name: b.name,
        description: b.description,
        tier: b.tier,
        iconKey: b.iconKey,
        sortOrder: b.sortOrder,
        pointsReward: b.pointsReward,
        isActive: true,
      },
      update: {
        name: b.name,
        description: b.description,
        tier: b.tier,
        iconKey: b.iconKey,
        sortOrder: b.sortOrder,
        pointsReward: b.pointsReward,
      },
    })
    if (existing) updated++
    else created++
  }

  console.log(`Seeded Tune Your Brain badges: ${created} created, ${updated} updated.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
