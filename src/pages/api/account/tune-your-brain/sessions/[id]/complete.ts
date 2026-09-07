import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import type { Prisma } from "@prisma/client"
import { applyGameCompletionRewards } from "@/lib/tuneBrain/rewardEngine"

// Flat XP for every phase so far -- full leveling/tier-threshold logic
// lives in src/lib/tuneBrain/progression.ts.
const FLAT_XP_PER_SESSION = 10

// Generic across every SCENARIO/FREE_TEXT/CALM_FOCUS game -- Kindness
// Quest (kind MISSION) never hits this endpoint; its accept/complete
// shape genuinely doesn't fit a single "submit an answer" step, so it has
// its own dedicated mark-done route that calls the same reward engine
// below instead of duplicating it.
const bodySchema = z.object({
  optionId: z.string().min(1).optional(),
  responseBody: z.string().min(1).max(2000).optional(),
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
  if (gameSession.gameKey === "KINDNESS_QUEST") {
    return res.status(400).json({ error: "Use the kindness mission mark-done endpoint for this game" })
  }

  const options = await db.tbContentItemOption.findMany({
    where: { contentItemId: gameSession.contentItemId },
  })

  // Correctness is always determined from server-loaded option data, never
  // trusted from the client. Not every game has options (Gratitude Quest
  // and Calm & Focus don't) -- a game with no TbContentItemOption rows for
  // its content simply has no "correct answer" concept, and completion
  // itself is the reward.
  let wasCorrect: boolean | null = null
  let explanation: string | null = null
  let outcome: Record<string, unknown> = {}

  if (options.length > 0) {
    if (!parsed.data.optionId) {
      return res.status(400).json({ error: "This game requires selecting an option" })
    }
    const chosen = options.find((o) => o.id === parsed.data.optionId)
    if (!chosen) return res.status(400).json({ error: "Invalid option for this session" })

    wasCorrect = chosen.isCorrectOrBest
    const bestOption = options.find((o) => o.isCorrectOrBest)
    explanation = bestOption?.explanation ?? null
    outcome = { optionId: chosen.id, wasCorrect }
  } else if (gameSession.gameKey === "GRATITUDE_QUEST") {
    if (!parsed.data.responseBody) {
      return res.status(400).json({ error: "A brief response is required" })
    }
    // outcome deliberately never carries the free-text body -- it lives
    // only in TbGratitudeEntry, which is never analytics'd or published.
    outcome = { hasResponse: true }
  }

  // Idempotency gate -- the write itself is the atomic check-and-set, scoped
  // on completedAt: null so two concurrent requests can't both pass a
  // read-then-write race. Only the request that actually flips the row from
  // null -> set proceeds to award anything; a second concurrent/retried
  // request gets count 0 and is rejected outright, never double-awarding.
  const updated = await db.tbGameSession.updateMany({
    where: { id, completedAt: null },
    data: { completedAt: new Date(), outcome: outcome as unknown as Prisma.InputJsonValue, xpAwarded: FLAT_XP_PER_SESSION },
  })
  if (updated.count === 0) return res.status(409).json({ error: "Session already completed" })

  if (gameSession.gameKey === "GRATITUDE_QUEST" && parsed.data.responseBody) {
    const contentItem = await db.tbContentItem.findUnique({ where: { id: gameSession.contentItemId } })
    await db.tbGratitudeEntry.create({
      data: {
        userId,
        sessionId: id,
        category: contentItem?.category ?? "general",
        body: parsed.data.responseBody,
      },
    })
  }

  await applyGameCompletionRewards({
    userId,
    gameKey: gameSession.gameKey,
    gameSessionId: gameSession.id,
    xpAwarded: FLAT_XP_PER_SESSION,
  })

  return res.json({
    wasCorrect,
    explanation,
    xpAwarded: FLAT_XP_PER_SESSION,
  })
}
