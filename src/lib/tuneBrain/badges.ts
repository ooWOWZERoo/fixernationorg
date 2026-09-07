import { db } from "@/lib/db"
import type { TbBadge, TbGameKey, TbLevelTier } from "@prisma/client"
import { tierRank } from "@/lib/tuneBrain/progression"
import { getMemberCalendarDate } from "@/lib/tuneBrainDate"
import { CORE_GAME_COUNT } from "@/lib/tuneBrain/registry"

export interface EvaluateBadgesParams {
  userId: string
  gameKey: TbGameKey
  newTier: TbLevelTier
  isFirstSessionEverForGame: boolean
}

// Data-driven: iterates this game's own TbBadge rows (tier badges + its
// first-session "starter" badge) rather than a hardcoded if/else chain, so
// a later phase's new game adds its own tier badges by seeding rows --
// never by editing this function. Award idempotency relies entirely on the
// @@unique([userId, badgeId]) constraint (create, catch violation, no-op),
// which is also what makes it safe to re-evaluate every session.
export async function evaluateBadgesForSession(params: EvaluateBadgesParams): Promise<TbBadge[]> {
  const { userId, gameKey, newTier, isFirstSessionEverForGame } = params

  const candidates = await db.tbBadge.findMany({ where: { isActive: true, gameKey } })

  const awarded: TbBadge[] = []
  for (const badge of candidates) {
    let eligible = false
    if (badge.tier === "STARTER") {
      // Nobody "levels up" into the tier they start at -- this game's
      // starter badge is keyed to its own first-ever completed session
      // instead of a tier crossing.
      eligible = isFirstSessionEverForGame
    } else if (badge.tier) {
      eligible = tierRank(badge.tier) <= tierRank(newTier)
    }

    if (!eligible) continue

    try {
      await db.tbUserBadge.create({ data: { userId, badgeId: badge.id } })
      awarded.push(badge)
    } catch {
      // @@unique([userId, badgeId]) violation -- already earned, no-op.
    }
  }

  return awarded
}

export interface EvaluateCrossGameBadgesParams {
  userId: string
  isFirstSessionEverForGame: boolean
  timezone: string | null
}

// Cross-game badges (gameKey: null) each have a genuinely distinct
// eligibility rule keyed off the badge's own `key` -- these are five
// specific, spec-named milestones (plus Phase 2's "Getting Tuned"), not a
// per-game switch statement. Every metric here is derived from data that
// already exists (TbGameSession/TbGameLevel), per the plan's instruction
// to reuse existing session-date data rather than add new tracking.
export async function evaluateCrossGameBadgesForSession(params: EvaluateCrossGameBadgesParams): Promise<TbBadge[]> {
  const { userId, isFirstSessionEverForGame, timezone } = params

  const candidates = await db.tbBadge.findMany({ where: { isActive: true, gameKey: null } })
  if (candidates.length === 0) return []

  const alreadyEarned = await db.tbUserBadge.findMany({
    where: { userId, badgeId: { in: candidates.map((c) => c.id) } },
    select: { badgeId: true },
  })
  const earnedIds = new Set(alreadyEarned.map((r) => r.badgeId))
  const unearned = candidates.filter((c) => !earnedIds.has(c.id))
  if (unearned.length === 0) return []

  const keysNeeded = new Set(unearned.map((b) => b.key))

  let isFirstSessionEverAnyGame = false
  let distinctGamesCompletedCount = 0
  let tiersAdvancedGameCount = 0
  let daysActiveCount = 0

  if (keysNeeded.has("getting_tuned")) {
    const totalCompleted = await db.tbGameSession.count({ where: { userId, completedAt: { not: null } } })
    isFirstSessionEverAnyGame = totalCompleted === 1
  }

  if (keysNeeded.has("tune_up") || keysNeeded.has("well_rounded") || keysNeeded.has("try_something_new")) {
    const distinctRows = await db.tbGameSession.findMany({
      where: { userId, completedAt: { not: null } },
      distinct: ["gameKey"],
      select: { gameKey: true },
    })
    distinctGamesCompletedCount = distinctRows.length
  }

  if (keysNeeded.has("growing_stronger")) {
    tiersAdvancedGameCount = await db.tbGameLevel.count({ where: { userId, tier: { not: "STARTER" } } })
  }

  if (keysNeeded.has("daily_rhythm")) {
    // Bounded lookback -- once 3 distinct days have happened this badge is
    // earned forever (idempotency backstop below), so there's no need to
    // ever scan a member's full session history for it.
    const recentSessions = await db.tbGameSession.findMany({
      where: { userId, completedAt: { not: null } },
      select: { completedAt: true },
      orderBy: { completedAt: "desc" },
      take: 200,
    })
    const days = new Set(
      recentSessions
        .filter((s) => s.completedAt)
        .map((s) => getMemberCalendarDate(s.completedAt as Date, timezone).getTime())
    )
    daysActiveCount = days.size
  }

  const awarded: TbBadge[] = []
  for (const badge of unearned) {
    let eligible = false
    switch (badge.key) {
      case "getting_tuned":
        eligible = isFirstSessionEverAnyGame
        break
      case "tune_up":
        eligible = distinctGamesCompletedCount >= 3
        break
      case "well_rounded":
        eligible = distinctGamesCompletedCount >= CORE_GAME_COUNT
        break
      case "try_something_new":
        // Only fires the first time THIS game is completed, and only once
        // the member has already completed at least one other distinct
        // game -- their very first game ever belongs to "Getting Tuned",
        // not this badge.
        eligible = isFirstSessionEverForGame && distinctGamesCompletedCount >= 2
        break
      case "daily_rhythm":
        eligible = daysActiveCount >= 3
        break
      case "growing_stronger":
        eligible = tiersAdvancedGameCount >= 3
        break
      default:
        eligible = false
    }

    if (!eligible) continue

    try {
      await db.tbUserBadge.create({ data: { userId, badgeId: badge.id } })
      awarded.push(badge)
    } catch {
      // @@unique([userId, badgeId]) violation -- already earned, no-op.
    }
  }

  return awarded
}
