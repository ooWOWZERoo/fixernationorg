import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { awardPoints } from "@/lib/loyalty"
import { createNotification } from "@/lib/notifications"
import { getMemberCalendarDate } from "@/lib/tuneBrainDate"
import { xpToTier, tierRank, LEVEL_UP_POINTS, TIER_LABELS } from "@/lib/tuneBrain/progression"
import { advanceStreak } from "@/lib/tuneBrain/streaks"
import { evaluateBadgesForSession } from "@/lib/tuneBrain/badges"
import { ensureGoalsAndUpdateProgress } from "@/lib/tuneBrain/goals"
import { GOAL_LABELS } from "@/lib/tuneBrain/goalConstants"
import { TB_GAME_REGISTRY } from "@/lib/tuneBrain/registry"

// Flat XP for every phase so far -- full leveling/tier-threshold logic
// (Phase 2) lives in src/lib/tuneBrain/progression.ts.
const FLAT_XP_PER_SESSION = 10

const bodySchema = z.object({
  optionId: z.string().min(1),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" })

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const { id } = req.query as { id: string }

  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const userId = session.user.id

  // Ownership/content checks are fine as a plain read -- only the
  // completedAt transition below needs to be atomic.
  const gameSession = await db.tbGameSession.findUnique({ where: { id } })
  if (!gameSession) return res.status(404).json({ error: "Not found" })
  if (gameSession.userId !== userId) return res.status(403).json({ error: "Forbidden" })
  if (!gameSession.contentItemId) return res.status(400).json({ error: "Session has no content" })

  const options = await db.tbContentItemOption.findMany({
    where: { contentItemId: gameSession.contentItemId },
  })

  const chosen = options.find((o) => o.id === parsed.data.optionId)
  if (!chosen) return res.status(400).json({ error: "Invalid option for this session" })

  // Correctness is always determined from server-loaded option data, never
  // trusted from the client.
  const wasCorrect = chosen.isCorrectOrBest
  const bestOption = options.find((o) => o.isCorrectOrBest)

  // Idempotency gate -- the write itself is the atomic check-and-set, scoped
  // on completedAt: null so two concurrent requests can't both pass a
  // read-then-write race. Only the request that actually flips the row from
  // null -> set proceeds to award anything; a second concurrent/retried
  // request gets count 0 and is rejected outright, never double-awarding.
  const updated = await db.tbGameSession.updateMany({
    where: { id, completedAt: null },
    data: {
      completedAt: new Date(),
      outcome: { optionId: chosen.id, wasCorrect },
      xpAwarded: FLAT_XP_PER_SESSION,
    },
  })
  if (updated.count === 0) return res.status(409).json({ error: "Session already completed" })

  const gameKey = gameSession.gameKey

  const user = await db.user.findUnique({ where: { id: userId } })
  const timezone = user?.timezone ?? null

  // ── Tier / XP ────────────────────────────────────────────────────────────
  const existingLevel = await db.tbGameLevel.findUnique({ where: { userId_gameKey: { userId, gameKey } } })
  const oldTier = existingLevel?.tier ?? "STARTER"

  const updatedLevel = await db.tbGameLevel.upsert({
    where: { userId_gameKey: { userId, gameKey } },
    create: { userId, gameKey, xp: FLAT_XP_PER_SESSION, tier: "STARTER" },
    update: { xp: { increment: FLAT_XP_PER_SESSION } },
  })

  const newTier = xpToTier(updatedLevel.xp)
  let leveledUp = false
  if (tierRank(newTier) > tierRank(oldTier)) {
    // State-transition gate: only the request that actually flips the tier
    // field from oldTier -> newTier counts as "leveled up" -- never on "a
    // request arrived while xp happened to already be past the threshold".
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

  // ── Badges ───────────────────────────────────────────────────────────────
  const [completedForGame, completedAnyGame] = await Promise.all([
    db.tbGameSession.count({ where: { userId, gameKey, completedAt: { not: null } } }),
    db.tbGameSession.count({ where: { userId, completedAt: { not: null } } }),
  ])

  const awardedBadges = await evaluateBadgesForSession({
    userId,
    gameKey,
    newTier,
    isFirstSessionEverForGame: completedForGame === 1,
    isFirstSessionEverAnyGame: completedAnyGame === 1,
  })

  // ── Goals ────────────────────────────────────────────────────────────────
  const completedGoals = await ensureGoalsAndUpdateProgress({ userId, gameKey, newTier, today })

  // ── Fire-and-forget rewards + notifications. These run after every core
  // write above has committed, and a failure here must never affect the
  // response or gameplay correctness -- matching enrollInJourneys'/
  // awardPoints' existing convention. ─────────────────────────────────────
  const gameLabel = TB_GAME_REGISTRY[gameKey]?.label ?? "Tune Your Brain"

  if (leveledUp) {
    const points = LEVEL_UP_POINTS[newTier] ?? 0
    if (points > 0) {
      awardPoints(userId, points, "TUNE_YOUR_BRAIN_LEVEL_UP", gameSession.id).catch(() => {})
    }
    createNotification(
      userId,
      "TUNE_YOUR_BRAIN_LEVEL_UP",
      `You reached ${TIER_LABELS[newTier] ?? newTier} in ${gameLabel}!`,
      "Your consistent practice is paying off -- keep it up.",
      "/tune-your-brain"
    ).catch(() => {})
  }

  for (const badge of awardedBadges) {
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
      const scopeLabel = streakResult.scope === "GLOBAL" ? "Tune Your Brain" : gameLabel
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

  return res.json({
    wasCorrect,
    explanation: bestOption?.explanation ?? null,
    xpAwarded: FLAT_XP_PER_SESSION,
  })
}
