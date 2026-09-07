import { db } from "@/lib/db"
import type { Prisma } from "@prisma/client"

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

// ── Reset-system support (SP-TB-P5) ─────────────────────────────────────────
// A SINGLE_GAME reset deletes that game's sessions but must leave the
// GLOBAL streak reflecting whatever activity remains across the member's
// other games -- it can't just be left stale, and it can't be blindly
// deleted either (the member may still have an active GLOBAL streak from
// other games). Recomputing from history (rather than replaying
// advanceStreak() day-by-day) is the only option once rows are gone, so this
// extracts the same "consecutive calendar day" math advanceStreak uses
// incrementally into a pure function over a full day list.
export function computeStreakFromDays(days: Date[]): { current: number; longest: number; lastActiveDate: Date | null } {
  if (days.length === 0) return { current: 0, longest: 0, lastActiveDate: null }

  const sorted = [...days].sort((a, b) => a.getTime() - b.getTime())
  let longest = 1
  let run = 1
  for (let i = 1; i < sorted.length; i++) {
    run = sorted[i].getTime() - sorted[i - 1].getTime() === DAY_MS ? run + 1 : 1
    longest = Math.max(longest, run)
  }

  // "Current" is the run ending at the most recent day -- mirrors
  // advanceStreak's semantics of never decaying `current` on its own; it
  // only ever changes in response to new (or, here, removed) activity.
  let current = 1
  for (let i = sorted.length - 1; i > 0; i--) {
    if (sorted[i].getTime() - sorted[i - 1].getTime() === DAY_MS) current += 1
    else break
  }

  return { current, longest, lastActiveDate: sorted[sorted.length - 1] }
}

// Persists a recomputed streak using a transaction client so it can run
// atomically alongside the deletions that made the recompute necessary. If
// no active days remain, the row is deleted outright -- matching
// advanceStreak's own rule that a scope has no Streak row until its first
// ever day of activity.
export async function recomputeStreakRow(
  tx: Prisma.TransactionClient,
  userId: string,
  scope: string,
  days: Date[]
): Promise<void> {
  const { current, longest, lastActiveDate } = computeStreakFromDays(days)

  if (!lastActiveDate) {
    await tx.streak.deleteMany({ where: { userId, scope } })
    return
  }

  await tx.streak.upsert({
    where: { userId_scope: { userId, scope } },
    create: { userId, scope, current, longest, lastActiveDate },
    update: { current, longest, lastActiveDate },
  })
}
