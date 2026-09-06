import type { TbLevelTier } from "@prisma/client"

// Pure tier-threshold table -- flat 10 XP/session, paced for a casual
// "5-15 min/day" feature: roughly a handful of sessions to clear the early
// tiers, more at the higher ones.
export const TIER_ORDER: TbLevelTier[] = [
  "STARTER",
  "EXPLORER",
  "BUILDER",
  "CHALLENGER",
  "SKILLED",
  "ADVANCED",
  "CHAMPION",
]

export const TIER_XP_THRESHOLDS: Record<TbLevelTier, number> = {
  STARTER: 0,
  EXPLORER: 30, // ~3 sessions
  BUILDER: 80, // ~8 sessions
  CHALLENGER: 150, // ~15 sessions
  SKILLED: 250, // ~25 sessions
  ADVANCED: 400, // ~40 sessions
  CHAMPION: 600, // ~60 sessions
}

export const TIER_LABELS: Record<TbLevelTier, string> = {
  STARTER: "Starter",
  EXPLORER: "Explorer",
  BUILDER: "Builder",
  CHALLENGER: "Challenger",
  SKILLED: "Skilled",
  ADVANCED: "Advanced",
  CHAMPION: "Champion",
}

// Community Points bonus for crossing INTO a tier -- kept separate from any
// tier badge's own pointsReward. A level-up and a badge earned are two
// distinct, independently-meaningful moments even when they coincide on
// the same session.
export const LEVEL_UP_POINTS: Record<TbLevelTier, number> = {
  STARTER: 0, // nobody "levels up" into the tier they start at
  EXPLORER: 10,
  BUILDER: 15,
  CHALLENGER: 20,
  SKILLED: 25,
  ADVANCED: 30,
  CHAMPION: 50,
}

export function xpToTier(xp: number): TbLevelTier {
  let result: TbLevelTier = "STARTER"
  for (const tier of TIER_ORDER) {
    if (xp >= TIER_XP_THRESHOLDS[tier]) result = tier
  }
  return result
}

export function tierRank(tier: TbLevelTier): number {
  return TIER_ORDER.indexOf(tier)
}
