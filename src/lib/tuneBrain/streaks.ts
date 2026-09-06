import { db } from "@/lib/db"

const DAY_MS = 24 * 60 * 60 * 1000
export const STREAK_MILESTONES = [7, 30, 100]

export interface StreakAdvanceResult {
  scope: string
  current: number
  longest: number
  crossedMilestone: number | null
}

function crossedAt(oldCurrent: number, newCurrent: number): number | null {
  for (const m of STREAK_MILESTONES) {
    if (oldCurrent < m && newCurrent >= m) return m
  }
  return null
}

// Advances the streak for one scope (a TbGameKey value, or the literal
// "GLOBAL") by at most one calendar day per call, using the member's own
// calendar date (via getMemberCalendarDate upstream). Multiple completions
// in the same day never double-count -- sessions and streak-days are
// deliberately decoupled. A gap of any length just restarts `current` at 1;
// there is no punitive reset path anywhere in this function.
export async function advanceStreak(userId: string, scope: string, todayDate: Date): Promise<StreakAdvanceResult> {
  const existing = await db.streak.findUnique({ where: { userId_scope: { userId, scope } } })

  if (!existing) {
    await db.streak.create({ data: { userId, scope, current: 1, longest: 1, lastActiveDate: todayDate } })
    return { scope, current: 1, longest: 1, crossedMilestone: null }
  }

  if (existing.lastActiveDate.getTime() === todayDate.getTime()) {
    // Already counted today -- unlimited replay shouldn't double-count.
    return { scope, current: existing.current, longest: existing.longest, crossedMilestone: null }
  }

  const isConsecutive = existing.lastActiveDate.getTime() === todayDate.getTime() - DAY_MS
  const newCurrent = isConsecutive ? existing.current + 1 : 1
  const newLongest = Math.max(existing.longest, newCurrent)

  // Compare-and-swap on lastActiveDate so two concurrent completions (e.g.
  // two open tabs) can't both advance the streak for the same day.
  const cas = await db.streak.updateMany({
    where: { userId, scope, lastActiveDate: existing.lastActiveDate },
    data: { current: newCurrent, longest: newLongest, lastActiveDate: todayDate },
  })

  if (cas.count === 0) {
    const fresh = await db.streak.findUnique({ where: { userId_scope: { userId, scope } } })
    return {
      scope,
      current: fresh?.current ?? newCurrent,
      longest: fresh?.longest ?? newLongest,
      crossedMilestone: null,
    }
  }

  return { scope, current: newCurrent, longest: newLongest, crossedMilestone: crossedAt(existing.current, newCurrent) }
}
