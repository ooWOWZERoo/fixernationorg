import { db } from "@/lib/db"
import type { TbGameKey } from "@prisma/client"
import { awardPoints } from "@/lib/loyalty"
import { createNotification } from "@/lib/notifications"
import { getMemberCalendarDate } from "@/lib/tuneBrainDate"
import { xpToTier, tierRank, LEVEL_UP_POINTS, TIER_LABELS } from "@/lib/tuneBrain/progression"
import { advanceStreak } from "@/lib/tuneBrain/streaks"
import { evaluateBadgesForSession, evaluateCrossGameBadgesForSession } from "@/lib/tuneBrain/badges"
import { ensureGoalsAndUpdateProgress } from "@/lib/tuneBrain/goals"
import { GOAL_LABELS } from "@/lib/tuneBrain/goalConstants"
import { TB_GAME_REGISTRY } from "@/lib/tuneBrain/registry"

// Everything that happens AFTER a TbGameSession's completedAt has already
// been atomically flipped from null -> set by the caller (the caller owns
// its own game-specific idempotency gate and outcome/xp write -- this
// function assumes that has already happened exactly once for this
// session). Centralizes tier/XP, streaks, per-game + cross-game badges,
// goals, and the fire-and-forget points/notification dispatch so every
// completion route (the generic complete.ts endpoint, and Kindness
// Quest's dedicated mark-done route) shares one reward engine instead of
// duplicating this logic inline.
export async function applyGameCompletionRewards(params: {
  userId: string
  gameKey: TbGameKey
  gameSessionId: string
  xpAwarded: number
}): Promise<void> {
  const { userId, gameKey, gameSessionId, xpAwarded } = params

  const user = await db.user.findUnique({ where: { id: userId } })
  const timezone = user?.timezone ?? null

  // ── Tier / XP ────────────────────────────────────────────────────────────
  const existingLevel = await db.tbGameLevel.findUnique({ where: { userId_gameKey: { userId, gameKey } } })
  const oldTier = existingLevel?.tier ?? "STARTER"

  const updatedLevel = await db.tbGameLevel.upsert({
    where: { userId_gameKey: { userId, gameKey } },
    create: { userId, gameKey, xp: xpAwarded, tier: "STARTER" },
    update: { xp: { increment: xpAwarded } },
  })

  const newTier = xpToTier(updatedLevel.xp)
  let leveledUp = false
  if (tierRank(newTier) > tierRank(oldTier)) {
    // State-transition gate: only the request that actually flips the tier
    // field from oldTier -> newTier counts as "leveled up".
    const tierUpdate = await db.tbGameLevel.updateMany({
      where: { userId, gameKey, tier: oldTier },
      data: { tier: newTier },
    })
    leveledUp = tierUpdate.count > 0
  }

  // ── Streaks (per-game scope + the cross-game GLOBAL scope) ──────────────
  const today = getMemberCalendarDate(new Date(), timezone)
  const [gameStreak, globalStreak] = await Promise.all([
    advanceStreak(userId, gameKey, today),
    advanceStreak(userId, "GLOBAL", today),
  ])

  // ── Badges (per-game, then cross-game) ──────────────────────────────────
  const completedForGame = await db.tbGameSession.count({ where: { userId, gameKey, completedAt: { not: null } } })
  const isFirstSessionEverForGame = completedForGame === 1

  const awardedBadges = await evaluateBadgesForSession({ userId, gameKey, newTier, isFirstSessionEverForGame })
  const awardedCrossGameBadges = await evaluateCrossGameBadgesForSession({
    userId,
    isFirstSessionEverForGame,
    timezone,
  })

  // ── Goals ────────────────────────────────────────────────────────────────
  const completedGoals = await ensureGoalsAndUpdateProgress({ userId, gameKey, newTier, today })

  // ── Fire-and-forget rewards + notifications. These run after every core
  // write above has committed, and a failure here must never affect the
  // response or gameplay correctness -- matching enrollInJourneys'/
  // awardPoints' existing convention. ─────────────────────────────────────
  const gameLabel = TB_GAME_REGISTRY[gameKey]?.label ?? "Brain Builder"

  if (leveledUp) {
    const points = LEVEL_UP_POINTS[newTier] ?? 0
    if (points > 0) {
      awardPoints(userId, points, "TUNE_YOUR_BRAIN_LEVEL_UP", gameSessionId).catch(() => {})
    }
    createNotification(
      userId,
      "TUNE_YOUR_BRAIN_LEVEL_UP",
      `You reached ${TIER_LABELS[newTier] ?? newTier} in ${gameLabel}!`,
      "Your consistent practice is paying off -- keep it up.",
      "/tune-your-brain"
    ).catch(() => {})
  }

  for (const badge of [...awardedBadges, ...awardedCrossGameBadges]) {
    if (badge.pointsReward > 0) {
      awardPoints(userId, badge.pointsReward, "TUNE_YOUR_BRAIN_BADGE_EARNED", badge.id).catch(() => {})
    }
    createNotification(
      userId,
      "TUNE_YOUR_BRAIN_BADGE_EARNED",
      `Badge earned: ${badge.name}`,
      badge.description,
      "/tune-your-brain"
    ).catch(() => {})
  }

  for (const streakResult of [gameStreak, globalStreak]) {
    if (streakResult.crossedMilestone) {
      const scopeLabel = streakResult.scope === "GLOBAL" ? "Brain Builder" : gameLabel
      createNotification(
        userId,
        "TUNE_YOUR_BRAIN_STREAK_MILESTONE",
        `${streakResult.crossedMilestone}-day streak!`,
        `You've shown up for ${scopeLabel} ${streakResult.crossedMilestone} days in a row. Keep that rhythm going.`,
        "/tune-your-brain"
      ).catch(() => {})
    }
  }

  for (const completedGoal of completedGoals) {
    awardPoints(userId, completedGoal.bonusPoints, "TUNE_YOUR_BRAIN_GOAL_COMPLETED", completedGoal.goal.id).catch(() => {})
    createNotification(
      userId,
      "TUNE_YOUR_BRAIN_GOAL_COMPLETED",
      "Goal complete!",
      `You completed "${GOAL_LABELS[completedGoal.goal.key] ?? completedGoal.goal.key}" -- nice work.`,
      "/tune-your-brain"
    ).catch(() => {})
  }
}
