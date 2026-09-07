import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { getMemberCalendarDate } from "@/lib/tuneBrainDate"
import { TB_GAME_REGISTRY, CORE_GAME_KEYS } from "@/lib/tuneBrain/registry"
import { DAILY_GOAL_KEY } from "@/lib/tuneBrain/goalConstants"

// A lightweight, computed-on-the-fly "what should I play today" heuristic
// for My Home's independent "Today's Tune-Up" card. Deliberately NOT the
// TbDailyChallenge model's job -- that table still has no selection logic
// wired to it anywhere (deferred), and this card doesn't need any new
// persisted state to do its job well.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" })

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const userId = session.user.id

  const sessionCount = await db.tbGameSession.count({ where: { userId } })

  if (sessionCount === 0) {
    // Brand-new member -- no streak/tier/goal data exists yet, so this is
    // purely the spec's first-time framing, not a game recommendation.
    return res.json({ isNew: true })
  }

  const user = await db.user.findUnique({ where: { id: userId }, select: { timezone: true } })
  const today = getMemberCalendarDate(new Date(), user?.timezone ?? null)

  const [dailyGoal, globalStreak, levelRows, lastPlayedRows] = await Promise.all([
    db.tbGoal.findFirst({
      where: { userId, key: DAILY_GOAL_KEY, period: "DAILY", status: "ACTIVE", periodStart: today },
    }),
    db.streak.findUnique({ where: { userId_scope: { userId, scope: "GLOBAL" } } }),
    db.tbGameLevel.findMany({ where: { userId } }),
    db.tbGameSession.findMany({
      where: { userId, gameKey: { in: CORE_GAME_KEYS as never[] } },
      orderBy: { createdAt: "desc" },
      select: { gameKey: true, createdAt: true },
    }),
  ])

  // Least-recently-played heuristic: a game never played sorts before any
  // game that has been played, then earliest last-played wins.
  const lastPlayedByGame = new Map<string, Date>()
  for (const row of lastPlayedRows) {
    if (!lastPlayedByGame.has(row.gameKey)) lastPlayedByGame.set(row.gameKey, row.createdAt)
  }
  const recommendedGameKey = [...CORE_GAME_KEYS].sort((a, b) => {
    const aTime = lastPlayedByGame.get(a)?.getTime() ?? 0
    const bTime = lastPlayedByGame.get(b)?.getTime() ?? 0
    return aTime - bTime
  })[0]

  const game = TB_GAME_REGISTRY[recommendedGameKey]
  const levelForGame = levelRows.find((l) => l.gameKey === recommendedGameKey)

  return res.json({
    isNew: false,
    hasIncompleteDailyGoal: !!dailyGoal,
    game: {
      key: game.key,
      label: game.label,
      emoji: game.emoji,
      routeSlug: game.routeSlug,
      tier: levelForGame?.tier ?? null,
    },
    globalStreak: globalStreak?.current ?? 0,
  })
}
