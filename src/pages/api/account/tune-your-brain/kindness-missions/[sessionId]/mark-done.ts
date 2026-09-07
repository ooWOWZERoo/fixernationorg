import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { applyGameCompletionRewards } from "@/lib/tuneBrain/rewardEngine"

// Flat XP for every phase so far, matching the generic complete.ts route.
const FLAT_XP_PER_SESSION = 10

// "Great"/"Good"/"Neutral"/"Interesting" map onto a small int scale purely
// so the mood follow-up can be aggregated later -- no UI ever shows these
// numbers, and no proof of the mission is required.
const MOOD_SCALE: Record<string, number> = { Great: 4, Good: 3, Neutral: 2, Interesting: 1 }

const bodySchema = z.object({
  moodAfter: z.enum(["Great", "Good", "Neutral", "Interesting"]).optional(),
})

// Kindness Quest is the one game whose accept-then-complete flow doesn't
// fit the generic single-step /sessions/[id]/complete endpoint (accepting
// a mission != completing it), so it gets this one dedicated route --
// but the actual reward logic (tier/XP, streaks, badges, goals,
// notifications) still goes through the same shared reward engine every
// other game's completion uses, never a duplicated copy.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" })

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const { sessionId } = req.query as { sessionId: string }

  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const userId = session.user.id

  const gameSession = await db.tbGameSession.findUnique({ where: { id: sessionId } })
  if (!gameSession) return res.status(404).json({ error: "Not found" })
  if (gameSession.userId !== userId) return res.status(403).json({ error: "Forbidden" })
  if (gameSession.gameKey !== "KINDNESS_QUEST") {
    return res.status(400).json({ error: "Not a kindness mission session" })
  }

  const mission = await db.tbKindnessMission.findUnique({ where: { sessionId } })
  if (!mission) return res.status(404).json({ error: "Mission not found" })

  const moodValue = parsed.data.moodAfter ? MOOD_SCALE[parsed.data.moodAfter] : null

  // Idempotency gate on the mission row's own completedAt -- same
  // state-transition rule as complete.ts (gate on the field actually
  // flipping, never on request count). Whichever request wins this CAS is
  // the only one that goes on to touch TbGameSession/the reward engine.
  const updated = await db.tbKindnessMission.updateMany({
    where: { sessionId, completedAt: null },
    data: { completedAt: new Date(), moodAfter: moodValue },
  })
  if (updated.count === 0) return res.status(409).json({ error: "Mission already marked done" })

  await db.tbGameSession.update({
    where: { id: sessionId },
    data: {
      completedAt: new Date(),
      outcome: { moodAfter: parsed.data.moodAfter ?? null },
      xpAwarded: FLAT_XP_PER_SESSION,
    },
  })

  await applyGameCompletionRewards({
    userId,
    gameKey: "KINDNESS_QUEST",
    gameSessionId: sessionId,
    xpAwarded: FLAT_XP_PER_SESSION,
  })

  return res.json({ ok: true })
}
