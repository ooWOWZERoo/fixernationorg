import { db } from "@/lib/db"
import type { TbBadge, TbGameKey, TbLevelTier } from "@prisma/client"
import { tierRank } from "@/lib/tuneBrain/progression"

export interface EvaluateBadgesParams {
  userId: string
  gameKey: TbGameKey
  newTier: TbLevelTier
  isFirstSessionEverForGame: boolean
  isFirstSessionEverAnyGame: boolean
}

// Data-driven: iterates TbBadge rows matching this game (or cross-game
// rows) rather than a hardcoded if/else chain, so a later phase's new game
// adds its own tier badges by seeding rows -- never by editing this
// function. Award idempotency relies entirely on the
// @@unique([userId, badgeId]) constraint (create, catch violation, no-op),
// which is also what makes it safe to re-evaluate every session.
export async function evaluateBadgesForSession(params: EvaluateBadgesParams): Promise<TbBadge[]> {
  const { userId, gameKey, newTier, isFirstSessionEverForGame, isFirstSessionEverAnyGame } = params

  const candidates = await db.tbBadge.findMany({
    where: { isActive: true, OR: [{ gameKey }, { gameKey: null }] },
  })

  const awarded: TbBadge[] = []
  for (const badge of candidates) {
    let eligible = false
    if (badge.gameKey === null) {
      // Cross-game badges are evaluated generically over "any completed
      // session, ever" -- correct automatically once more games exist,
      // never hardcoded to Positive Reframe.
      eligible = isFirstSessionEverAnyGame
    } else if (badge.tier === "STARTER") {
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
