import { db } from "@/lib/db"
import type { TbGoal, TbGameKey, TbLevelTier, TbGoalPeriod } from "@prisma/client"
import { tierRank } from "@/lib/tuneBrain/progression"
import { DAY_MS, DAILY_GOAL_KEY, WEEKLY_GOAL_KEY, PERSONAL_REFRAME_BUILDER_KEY, mondayOf } from "@/lib/tuneBrain/goalConstants"

// Flat bonus scaled by period -- modest and consistent, per the points
// design decision (Community Points stay rare/meaningful; rarity of
// period-completions is itself the rate limit, no anti-farming logic
// needed).
const GOAL_BONUS_POINTS: Record<TbGoalPeriod, number> = { DAILY: 5, WEEKLY: 15, PERSONAL: 25 }

export interface CompletedGoal {
  goal: TbGoal
  bonusPoints: number
}

async function ensureGoalExists(data: {
  userId: string
  key: string
  period: TbGoalPeriod
  target: number
  periodStart: Date
  periodEnd: Date | null
}) {
  try {
    await db.tbGoal.create({ data: { ...data, progress: 0, status: "ACTIVE" } })
  } catch {
    // @@unique([userId, key, periodStart]) -- already exists, no-op.
  }
}

async function bumpCountGoal(userId: string, key: string, periodStart: Date, period: TbGoalPeriod): Promise<CompletedGoal[]> {
  const goal = await db.tbGoal.findFirst({ where: { userId, key, periodStart, status: "ACTIVE" } })
  if (!goal) return []

  // Atomic increment -- avoids a lost-update race if two sessions complete
  // at nearly the same moment (e.g. two open tabs).
  await db.tbGoal.updateMany({ where: { id: goal.id, status: "ACTIVE" }, data: { progress: { increment: 1 } } })

  const fresh = await db.tbGoal.findUnique({ where: { id: goal.id } })
  if (!fresh || fresh.status !== "ACTIVE" || fresh.progress < fresh.target) return []

  // State-transition gate: only the request that actually flips ACTIVE ->
  // COMPLETED gets credited; a concurrent duplicate is a no-op.
  const cas = await db.tbGoal.updateMany({
    where: { id: goal.id, status: "ACTIVE" },
    data: { status: "COMPLETED", completedAt: new Date() },
  })
  if (cas.count === 0) return []
  return [{ goal: { ...fresh, status: "COMPLETED" }, bonusPoints: GOAL_BONUS_POINTS[period] }]
}

async function checkTierGoal(
  userId: string,
  key: string,
  newTier: TbLevelTier,
  requiredTier: TbLevelTier,
  period: TbGoalPeriod
): Promise<CompletedGoal[]> {
  const goal = await db.tbGoal.findFirst({ where: { userId, key, status: "ACTIVE" } })
  if (!goal) return []
  if (tierRank(newTier) < tierRank(requiredTier)) return []

  const cas = await db.tbGoal.updateMany({
    where: { id: goal.id, status: "ACTIVE" },
    data: { progress: goal.target, status: "COMPLETED", completedAt: new Date() },
  })
  if (cas.count === 0) return []
  return [{ goal: { ...goal, progress: goal.target, status: "COMPLETED" }, bonusPoints: GOAL_BONUS_POINTS[period] }]
}

// Lazily creates this member's DAILY/WEEKLY/PERSONAL goals the first time
// they're relevant (no cron), then updates progress for whichever goals
// this completed session matches. Daily/weekly count ANY game generically
// (Phase 3's new games automatically qualify); the personal goal is
// Positive-Reframe-specific per the spec and is only ever touched when
// that's the game just played.
export async function ensureGoalsAndUpdateProgress(params: {
  userId: string
  gameKey: TbGameKey
  newTier: TbLevelTier
  today: Date
}): Promise<CompletedGoal[]> {
  const { userId, gameKey, newTier, today } = params
  const monday = mondayOf(today)
  const sunday = new Date(monday.getTime() + 6 * DAY_MS)

  await ensureGoalExists({ userId, key: DAILY_GOAL_KEY, period: "DAILY", target: 1, periodStart: today, periodEnd: today })
  await ensureGoalExists({ userId, key: WEEKLY_GOAL_KEY, period: "WEEKLY", target: 3, periodStart: monday, periodEnd: sunday })

  const existingPersonal = await db.tbGoal.findFirst({ where: { userId, key: PERSONAL_REFRAME_BUILDER_KEY } })
  if (!existingPersonal) {
    await ensureGoalExists({ userId, key: PERSONAL_REFRAME_BUILDER_KEY, period: "PERSONAL", target: 1, periodStart: today, periodEnd: null })
  }

  const completed: CompletedGoal[] = []
  completed.push(...(await bumpCountGoal(userId, DAILY_GOAL_KEY, today, "DAILY")))
  completed.push(...(await bumpCountGoal(userId, WEEKLY_GOAL_KEY, monday, "WEEKLY")))

  if (gameKey === "POSITIVE_REFRAME") {
    completed.push(...(await checkTierGoal(userId, PERSONAL_REFRAME_BUILDER_KEY, newTier, "BUILDER", "PERSONAL")))
  }

  return completed
}
