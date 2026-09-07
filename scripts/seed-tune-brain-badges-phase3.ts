/**
 * Tune Your Brain — Phase 3 badge seed: the 7-tier badge sets for
 * Gratitude Quest, Kindness Quest, Calm & Focus, Strength Spotter, and
 * Wellness Choices, plus the 5 new cross-game badges (Tune-Up, Well
 * Rounded, Try Something New, Daily Rhythm, Growing Stronger) that only
 * make sense now that more than one game exists.
 * npx dotenv -e .env.neon.local -- npx tsx scripts/seed-tune-brain-badges-phase3.ts
 *
 * Idempotent: TbBadge.key is unique, so this upserts by key -- safe to
 * re-run any time copy changes, mirroring seed-tune-brain-badges.ts's
 * idiom exactly.
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

const TIERS: { tier: TbLevelTier; iconSuffix: number; points: number }[] = [
  { tier: "STARTER", iconSuffix: 1, points: 10 },
  { tier: "EXPLORER", iconSuffix: 2, points: 15 },
  { tier: "BUILDER", iconSuffix: 3, points: 20 },
  { tier: "CHALLENGER", iconSuffix: 4, points: 25 },
  { tier: "SKILLED", iconSuffix: 5, points: 30 },
  { tier: "ADVANCED", iconSuffix: 6, points: 40 },
  { tier: "CHAMPION", iconSuffix: 7, points: 50 },
]

function tierBadges(gameKey: TbGameKey, iconPrefix: string, names: string[], descriptions: string[], sortStart: number): BadgeSeed[] {
  return TIERS.map((t, i) => ({
    key: `${iconPrefix}_${t.tier.toLowerCase()}`,
    gameKey,
    name: names[i],
    description: descriptions[i],
    tier: t.tier,
    iconKey: `${iconPrefix}-${t.iconSuffix}`,
    sortOrder: sortStart + i,
    pointsReward: t.points,
  }))
}

const GRATITUDE: BadgeSeed[] = tierBadges(
  "GRATITUDE_QUEST",
  "gratitude",
  [
    "First Thanks",
    "Gratitude Explorer",
    "Little Things Matter",
    "Thankful Three",
    "Seven Days of Thanks",
    "Gratitude Builder",
    "Gratitude Champion",
  ],
  [
    "You wrote your first Gratitude Quest entry -- a small habit worth keeping.",
    "You're building a habit of noticing the good, one prompt at a time.",
    "You're catching the small stuff -- the little things really do add up.",
    "Three entries in -- gratitude is starting to feel like a habit, not a task.",
    "A full week of noticing something good -- that consistency is the real win.",
    "You've made real space for gratitude in your everyday routine.",
    "You've made noticing the good a genuine strength.",
  ],
  20
)

const KINDNESS: BadgeSeed[] = tierBadges(
  "KINDNESS_QUEST",
  "kindness",
  [
    "First Good Deed",
    "Helping Hand",
    "Good Neighbor",
    "Encourager",
    "Positivity Spreader",
    "Community Builder",
    "Kindness Champion",
  ],
  [
    "You completed your first Kindness Quest mission -- that's one more good thing out in the world.",
    "You're becoming the kind of person who follows through on small kindnesses.",
    "You're showing up for the people around you, mission after mission.",
    "You've made a habit of lifting other people up.",
    "The kindness you're putting out is genuinely spreading.",
    "You're helping build a stronger, kinder community, one mission at a time.",
    "You've made kindness a real, ongoing habit -- that matters.",
  ],
  27
)

const CALM_FOCUS: BadgeSeed[] = tierBadges(
  "CALM_FOCUS",
  "calm",
  [
    "Take a Moment",
    "One Minute Reset",
    "Focus Finder",
    "Mindful Moment",
    "Calm Explorer",
    "Focus Builder",
    "Calm & Focus Champion",
  ],
  [
    "You took your first Calm & Focus moment -- however it went, that's the whole point.",
    "You're building the habit of pausing to reset, even just for a minute.",
    "You're getting better at finding a moment of focus when you need one.",
    "You're making mindful pauses part of your day.",
    "You're exploring different ways to reset -- keep noticing what works for you.",
    "Calm and focus are becoming real, reachable habits for you.",
    "You've built a genuine practice of resetting when you need it.",
  ],
  34
)

const STRENGTH: BadgeSeed[] = tierBadges(
  "STRENGTH_SPOTTER",
  "strength",
  [
    "Strength Seeker",
    "Character Detective",
    "Strength Spotter",
    "Strength Collector",
    "Know Your Strengths",
    "Strength Builder",
    "Strength Champion",
  ],
  [
    "You played your first round of Strength Spotter -- a good eye for character starts here.",
    "You're getting sharper at spotting the strength behind an everyday moment.",
    "You've got a genuine knack for naming the strength at work in a scenario.",
    "You're building a real collection of strengths you can recognize on sight.",
    "You know your strengths -- and you're getting quicker at spotting them in others too.",
    "You've built real skill at recognizing character strengths in everyday situations.",
    "You've mastered spotting strengths, even in the subtle cases.",
  ],
  41
)

const WELLNESS: BadgeSeed[] = tierBadges(
  "WELLNESS_CHOICES",
  "wellness",
  [
    "Healthy Choice",
    "Wellness Explorer",
    "Better Habits",
    "Balanced Choice",
    "Wellness Builder",
    "Healthy Habits Hero",
    "Wellness Champion",
  ],
  [
    "You made your first Wellness Choices pick -- small everyday choices add up.",
    "You're exploring what a healthier everyday choice looks like.",
    "You're building better habits, one everyday decision at a time.",
    "You're finding the balanced choice more often than not.",
    "You're building a real foundation of wellness-minded habits.",
    "You're a genuine model for healthy everyday habits.",
    "You've mastered making the healthier call in everyday moments.",
  ],
  48
)

// Cross-game badges (gameKey: null) -- these only became meaningful once
// more than one game existed, so they were deliberately deferred from
// Phase 2 to Phase 3.
const CROSS_GAME: BadgeSeed[] = [
  {
    key: "tune_up",
    gameKey: null,
    name: "Tune-Up",
    description: "You've completed sessions in 3 different Tune Your Brain games.",
    tier: null,
    iconKey: "tuneup-3",
    sortOrder: 55,
    pointsReward: 20,
  },
  {
    key: "well_rounded",
    gameKey: null,
    name: "Well Rounded",
    description: "You've completed at least one session in all 6 Tune Your Brain games.",
    tier: null,
    iconKey: "wellrounded-7",
    sortOrder: 56,
    pointsReward: 40,
  },
  {
    key: "try_something_new",
    gameKey: null,
    name: "Try Something New",
    description: "You played a Tune Your Brain game you hadn't tried before.",
    tier: null,
    iconKey: "trynew-2",
    sortOrder: 57,
    pointsReward: 15,
  },
  {
    key: "daily_rhythm",
    gameKey: null,
    name: "Daily Rhythm",
    description: "You've shown up for Tune Your Brain on 3 different days.",
    tier: null,
    iconKey: "dailyrhythm-4",
    sortOrder: 58,
    pointsReward: 20,
  },
  {
    key: "growing_stronger",
    gameKey: null,
    name: "Growing Stronger",
    description: "You've advanced a tier in 3 different Tune Your Brain games.",
    tier: null,
    iconKey: "growingstronger-6",
    sortOrder: 59,
    pointsReward: 30,
  },
]

const BADGES: BadgeSeed[] = [...GRATITUDE, ...KINDNESS, ...CALM_FOCUS, ...STRENGTH, ...WELLNESS, ...CROSS_GAME]

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

  console.log(`Seeded Tune Your Brain Phase 3 badges: ${created} created, ${updated} updated.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
