import { db } from "@/lib/db"
import type { Prisma, TbGameKey } from "@prisma/client"
import { getMemberCalendarDate } from "@/lib/tuneBrainDate"
import { recomputeStreakRow } from "@/lib/tuneBrain/streaks"
import { PERSONAL_REFRAME_BUILDER_KEY } from "@/lib/tuneBrain/goalConstants"
import { TB_GAME_REGISTRY } from "@/lib/tuneBrain/registry"
import {
  RESET_SCOPES,
  type ResetScope,
  TB_POINT_REASONS,
  TB_ALL_POINT_REASONS,
  TB_RESET_POINT_REASON,
} from "@/lib/tuneBrain/resetConstants"

// Everything the admin reset system (SP-TB-P5) needs to know about "what a
// reset touches" lives here in one place -- the preview endpoint and the
// execute endpoint both call gatherResetData() so they can never drift from
// each other, and the execute endpoint never trusts a client-supplied count.
// The scope/reason/point-reason enums themselves live in resetConstants.ts
// (no `db` import) since the admin reset UI, a client component, needs some
// of them too; re-exported here so the API routes have one import path.
export { RESET_SCOPES, TB_POINT_REASONS, TB_ALL_POINT_REASONS, TB_RESET_POINT_REASON }
export type { ResetScope }

// Goal keys that belong to one specific game, as opposed to
// DAILY_GOAL_KEY/WEEKLY_GOAL_KEY which span every game and are never
// touched by a SINGLE_GAME reset. Only Positive Reframe has one today --
// this map is where a future game's personal goal key would be added, so
// the reset engine never needs a per-game switch statement.
export const GAME_SPECIFIC_GOAL_KEYS: Record<string, string[]> = {
  POSITIVE_REFRAME: [PERSONAL_REFRAME_BUILDER_KEY],
}

export class ResetValidationError extends Error {}
export class ResetNotFoundError extends Error {}

export interface ResetParams {
  userId: string
  scope: ResetScope
  gameKey?: TbGameKey
  badgeId?: string
  goalId?: string
}

export interface ResetPreview {
  sessionsAffected: number
  badgesAffected: { key: string; name: string }[]
  pointsToReverse: number
  goalsAffected: number
  streaksAffected: string[]
}

interface LoyaltyRowToReverse {
  id: string
  points: number
  reason: string
  resourceId: string | null
}

interface GoalRow {
  id: string
  key: string
  status: string
}

interface GatheredResetData {
  sessionIds: string[]
  badgeRows: { id: string; key: string; name: string }[]
  goalRows: GoalRow[]
  streakScopesToDelete: string[]
  recomputeGlobalStreak: boolean
  loyaltyRowsToReverse: LoyaltyRowToReverse[]
}

// Either the plain `db` client (for the read-only preview) or a
// `$transaction` callback's `tx` client (for the execute path) -- every
// query below only needs the small subset of the Prisma client surface
// both share.
type DbLike = typeof db | Prisma.TransactionClient

function gameLabel(gameKey: string): string {
  return TB_GAME_REGISTRY[gameKey]?.label ?? gameKey
}

// The single source of truth for "what does this reset touch." Called by
// the preview endpoint (against `db`) and by the execute endpoint (against
// the transaction's `tx`, immediately before deleting anything) so the two
// can never disagree, and so execute never has to trust a client-supplied
// count.
export async function gatherResetData(client: DbLike, params: ResetParams): Promise<GatheredResetData> {
  const { userId, scope } = params

  if (scope === "SINGLE_GAME") {
    if (!params.gameKey) throw new ResetValidationError("gameKey is required for a SINGLE_GAME reset.")
    const gameKey = params.gameKey

    const sessions = await client.tbGameSession.findMany({ where: { userId, gameKey }, select: { id: true } })
    const sessionIds = sessions.map((s) => s.id)

    const gameBadges = await client.tbBadge.findMany({
      where: { gameKey },
      select: { id: true, key: true, name: true },
    })
    const gameBadgeIds = gameBadges.map((b) => b.id)
    const earned = gameBadgeIds.length
      ? await client.tbUserBadge.findMany({ where: { userId, badgeId: { in: gameBadgeIds } }, select: { badgeId: true } })
      : []
    const earnedIds = new Set(earned.map((e) => e.badgeId))
    const badgeRows = gameBadges.filter((b) => earnedIds.has(b.id)).map((b) => ({ id: b.id, key: b.key, name: b.name }))

    const goalKeys = GAME_SPECIFIC_GOAL_KEYS[gameKey] ?? []
    const goalRows = goalKeys.length
      ? await client.tbGoal.findMany({ where: { userId, key: { in: goalKeys } }, select: { id: true, key: true, status: true } })
      : []

    const loyaltyRowsToReverse = await gatherPointsToReverse(client, userId, {
      levelUpResourceIds: sessionIds,
      badgeResourceIds: badgeRows.map((b) => b.id),
      goalResourceIds: goalRows.filter((g) => g.status === "COMPLETED").map((g) => g.id),
    })

    return {
      sessionIds,
      badgeRows,
      goalRows,
      streakScopesToDelete: [gameKey],
      recomputeGlobalStreak: true,
      loyaltyRowsToReverse,
    }
  }

  if (scope === "FULL") {
    const sessions = await client.tbGameSession.findMany({ where: { userId }, select: { id: true } })
    const sessionIds = sessions.map((s) => s.id)

    const earned = await client.tbUserBadge.findMany({
      where: { userId },
      select: { badgeId: true, badge: { select: { key: true, name: true } } },
    })
    const badgeRows = earned.map((e) => ({ id: e.badgeId, key: e.badge.key, name: e.badge.name }))

    const goals = await client.tbGoal.findMany({ where: { userId }, select: { id: true, key: true, status: true } })
    const streaks = await client.streak.findMany({ where: { userId }, select: { scope: true } })

    // FULL is the one scope where a naive "find every positive award row
    // and reverse it" is wrong: unlike SINGLE_GAME/BADGE/GOAL (which only
    // ever reverse points tied to specific sessions/badges/goals being
    // deleted in THIS transaction, so a repeat reset finds nothing left to
    // match), a second FULL reset on the same member -- weeks later, for an
    // unrelated reason, or a genuine double-submit -- would re-select the
    // SAME already-reversed positive rows and reverse them a second time,
    // since LoyaltyPoint rows are never deleted or mutated. There is no
    // per-row "already offset" flag to filter on, so the only correct fix
    // without a schema change is to reverse the member's net OUTSTANDING
    // balance, not their gross lifetime awards: sum every positive TB award
    // (by reason) minus every TB reset reversal ever recorded for them
    // (across ALL scopes/reset events, not just prior FULL resets -- a
    // reversal is a reversal regardless of which scope produced it). If
    // that net is <= 0, there is nothing left to reverse and no row is
    // created at all; this is what makes repeat/mixed-scope resets safe.
    const [awardedAgg, reversedAgg] = await Promise.all([
      client.loyaltyPoint.aggregate({ where: { userId, reason: { in: TB_ALL_POINT_REASONS } }, _sum: { points: true } }),
      client.loyaltyPoint.aggregate({ where: { userId, reason: TB_RESET_POINT_REASON }, _sum: { points: true } }),
    ])
    const netOutstanding = (awardedAgg._sum.points ?? 0) + (reversedAgg._sum.points ?? 0) // reversedAgg is <= 0
    const loyaltyRowsToReverse: LoyaltyRowToReverse[] =
      netOutstanding > 0 ? [{ id: "net-outstanding", points: netOutstanding, reason: TB_RESET_POINT_REASON, resourceId: null }] : []

    return {
      sessionIds,
      badgeRows,
      goalRows: goals,
      streakScopesToDelete: streaks.map((s) => s.scope),
      recomputeGlobalStreak: false,
      loyaltyRowsToReverse,
    }
  }

  if (scope === "BADGE") {
    if (!params.badgeId) throw new ResetValidationError("badgeId is required for a BADGE reset.")
    const badgeId = params.badgeId
    const userBadge = await client.tbUserBadge.findUnique({
      where: { userId_badgeId: { userId, badgeId } },
      select: { badge: { select: { key: true, name: true } } },
    })
    if (!userBadge) throw new ResetNotFoundError("This member has not earned that badge.")

    const loyaltyRowsToReverse = await client.loyaltyPoint.findMany({
      where: { userId, reason: TB_POINT_REASONS.BADGE_EARNED, resourceId: badgeId },
      select: { id: true, points: true, reason: true, resourceId: true },
    })

    return {
      sessionIds: [],
      badgeRows: [{ id: badgeId, key: userBadge.badge.key, name: userBadge.badge.name }],
      goalRows: [],
      streakScopesToDelete: [],
      recomputeGlobalStreak: false,
      loyaltyRowsToReverse,
    }
  }

  // scope === "GOAL" -- either one specific goal (any status, admin picked
  // it by id) or, when no goalId is given, every ACTIVE goal for this
  // member in bulk. See executeReset()'s comment for why goals are deleted
  // outright rather than zeroed in place.
  if (params.goalId) {
    const goal = await client.tbGoal.findUnique({ where: { id: params.goalId } })
    if (!goal || goal.userId !== userId) throw new ResetNotFoundError("Goal not found for this member.")

    const loyaltyRowsToReverse =
      goal.status === "COMPLETED"
        ? await client.loyaltyPoint.findMany({
            where: { userId, reason: TB_POINT_REASONS.GOAL_COMPLETED, resourceId: goal.id },
            select: { id: true, points: true, reason: true, resourceId: true },
          })
        : []

    return {
      sessionIds: [],
      badgeRows: [],
      goalRows: [{ id: goal.id, key: goal.key, status: goal.status }],
      streakScopesToDelete: [],
      recomputeGlobalStreak: false,
      loyaltyRowsToReverse,
    }
  }

  const activeGoals = await client.tbGoal.findMany({
    where: { userId, status: "ACTIVE" },
    select: { id: true, key: true, status: true },
  })
  return {
    sessionIds: [],
    badgeRows: [],
    goalRows: activeGoals,
    streakScopesToDelete: [],
    recomputeGlobalStreak: false,
    loyaltyRowsToReverse: [],
  }
}

async function gatherPointsToReverse(
  client: DbLike,
  userId: string,
  ids: { levelUpResourceIds: string[]; badgeResourceIds: string[]; goalResourceIds: string[] }
): Promise<LoyaltyRowToReverse[]> {
  const [levelUp, badge, goal] = await Promise.all([
    ids.levelUpResourceIds.length
      ? client.loyaltyPoint.findMany({
          where: { userId, reason: TB_POINT_REASONS.LEVEL_UP, resourceId: { in: ids.levelUpResourceIds } },
          select: { id: true, points: true, reason: true, resourceId: true },
        })
      : Promise.resolve([]),
    ids.badgeResourceIds.length
      ? client.loyaltyPoint.findMany({
          where: { userId, reason: TB_POINT_REASONS.BADGE_EARNED, resourceId: { in: ids.badgeResourceIds } },
          select: { id: true, points: true, reason: true, resourceId: true },
        })
      : Promise.resolve([]),
    ids.goalResourceIds.length
      ? client.loyaltyPoint.findMany({
          where: { userId, reason: TB_POINT_REASONS.GOAL_COMPLETED, resourceId: { in: ids.goalResourceIds } },
          select: { id: true, points: true, reason: true, resourceId: true },
        })
      : Promise.resolve([]),
  ])
  return [...levelUp, ...badge, ...goal]
}

// Renders the "will affect" half of the preview shown in the admin UI.
// buildNeverTouchedSummary() (below) renders the "will NOT affect" half
// from the plan's fixed never-touch list, independent of scope.
export function buildResetPreview(data: GatheredResetData): ResetPreview {
  const streaksAffected: string[] = [
    ...data.streakScopesToDelete.map((s) => (s === "GLOBAL" ? "Overall streak (all games)" : gameLabel(s))),
    ...(data.recomputeGlobalStreak ? ["Overall streak (all games) -- recalculated, not deleted"] : []),
  ]

  return {
    sessionsAffected: data.sessionIds.length,
    badgesAffected: data.badgeRows.map((b) => ({ key: b.key, name: b.name })),
    pointsToReverse: data.loyaltyRowsToReverse.reduce((sum, r) => sum + Math.abs(r.points), 0),
    goalsAffected: data.goalRows.length,
    streaksAffected,
  }
}

// Plain member-readable text for what a reset of this scope will NEVER
// touch -- rendered in the admin UI alongside the "will affect" preview so
// the blast radius is spelled out, not just implied. Independent of the
// specific member/game/badge/goal being targeted.
export function neverTouchedSummary(scope: ResetScope): string[] {
  const always = [
    "The member's account, login, email, or password",
    "Community posts, comments, reactions, and direct messages",
    "Group memberships",
    "Membership tier, billing, or Stripe records",
    "Any Community Points already on the ledger (a reset only adds new reversal entries -- it never edits or deletes existing point history)",
  ]
  if (scope === "SINGLE_GAME") {
    return [
      "Every other Tune Your Brain game's sessions, level, and badges",
      "The daily and weekly goals (they span all games)",
      ...always,
    ]
  }
  if (scope === "BADGE") {
    return ["The gameplay sessions and level progress that earned the badge -- this removes the badge only, not the history behind it", ...always]
  }
  if (scope === "GOAL") {
    return ["Session, level, badge, and streak history", ...always]
  }
  // FULL
  return always
}

// Performs the deletions/updates for a gathered reset inside the caller's
// $transaction. Must run against the same `tx` the caller used to compute
// `data`, immediately after gathering it, so nothing else can slip in
// between "what we're about to do" and "what we did."
export async function performResetDeletes(
  tx: Prisma.TransactionClient,
  params: ResetParams,
  data: GatheredResetData
): Promise<void> {
  const { userId, scope } = params

  if (data.sessionIds.length > 0) {
    // TbGratitudeEntry/TbKindnessMission both have onDelete: Cascade on
    // their sessionId FK -- deleting the session deletes them too.
    await tx.tbGameSession.deleteMany({ where: { id: { in: data.sessionIds } } })
  }

  if (scope === "SINGLE_GAME" && params.gameKey) {
    await tx.tbGameLevel.deleteMany({ where: { userId, gameKey: params.gameKey } })
  }
  if (scope === "FULL") {
    await tx.tbGameLevel.deleteMany({ where: { userId } })
  }

  if (data.badgeRows.length > 0) {
    const badgeIds = data.badgeRows.map((b) => b.id)
    // BadgeFeature has no FK/cascade back to TbUserBadge (it's a plain
    // userId+badgeId pointer), so it has to be cleared explicitly whenever
    // the underlying earned badge is removed, in every scope.
    await tx.badgeFeature.deleteMany({ where: { userId, badgeId: { in: badgeIds } } })
    await tx.tbUserBadge.deleteMany({ where: { userId, badgeId: { in: badgeIds } } })
  }

  if (data.goalRows.length > 0) {
    // Goals are deleted outright rather than zeroed in place -- they're
    // lazily recreated by ensureGoalsAndUpdateProgress() the next time the
    // member does anything relevant, which is simpler than reimplementing
    // "what a fresh goal for this period looks like" here, and is exactly
    // equivalent from the member's point of view.
    await tx.tbGoal.deleteMany({ where: { id: { in: data.goalRows.map((g) => g.id) } } })
  }

  if (data.streakScopesToDelete.length > 0) {
    await tx.streak.deleteMany({ where: { userId, scope: { in: data.streakScopesToDelete } } })
  }

  if (data.recomputeGlobalStreak) {
    const [user, remaining] = await Promise.all([
      tx.user.findUnique({ where: { id: userId }, select: { timezone: true } }),
      tx.tbGameSession.findMany({ where: { userId, completedAt: { not: null } }, select: { completedAt: true } }),
    ])
    const dayTimestamps = new Set(
      remaining.map((r) => getMemberCalendarDate(r.completedAt as Date, user?.timezone ?? null).getTime())
    )
    const days = Array.from(dayTimestamps, (t) => new Date(t))
    await recomputeStreakRow(tx, userId, "GLOBAL", days)
  }
}

export function auditActionForScope(scope: ResetScope): string {
  const suffix: Record<ResetScope, string> = {
    SINGLE_GAME: "single_game_reset",
    FULL: "full_reset",
    BADGE: "badge_reset",
    GOAL: "goal_reset",
  }
  return `tunebrain.${suffix[scope]}`
}
