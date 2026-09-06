import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// Flat XP for Phase 1 -- full leveling/tier-threshold logic is Phase 2.
const FLAT_XP_PER_SESSION = 10

type TbGameSessionRow = {
  id: string
  userId: string
  gameKey: string
  contentItemId: string | null
  completedAt: Date | null
}

type TbContentItemOptionRow = {
  id: string
  isCorrectOrBest: boolean
  explanation: string | null
}

type TbCompleteDb = {
  tbGameSession: {
    findUnique: (args: Record<string, unknown>) => Promise<TbGameSessionRow | null>
    update: (args: Record<string, unknown>) => Promise<unknown>
  }
  tbContentItemOption: {
    findMany: (args: Record<string, unknown>) => Promise<TbContentItemOptionRow[]>
  }
  tbGameLevel: {
    upsert: (args: Record<string, unknown>) => Promise<unknown>
  }
}
const db_ = db as never as TbCompleteDb

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

  const gameSession = await db_.tbGameSession.findUnique({ where: { id } })
  if (!gameSession) return res.status(404).json({ error: "Not found" })
  if (gameSession.userId !== session.user.id) return res.status(403).json({ error: "Forbidden" })
  if (!gameSession.contentItemId) return res.status(400).json({ error: "Session has no content" })

  // Idempotency gate -- reward/state-transition logic is gated on whether
  // completedAt just transitioned from null, never on request count or row
  // existence alone. A second completion attempt is rejected outright.
  if (gameSession.completedAt) return res.status(409).json({ error: "Session already completed" })

  const options = await db_.tbContentItemOption.findMany({
    where: { contentItemId: gameSession.contentItemId },
  })

  const chosen = options.find((o) => o.id === parsed.data.optionId)
  if (!chosen) return res.status(400).json({ error: "Invalid option for this session" })

  // Correctness is always determined from server-loaded option data, never
  // trusted from the client.
  const wasCorrect = chosen.isCorrectOrBest
  const bestOption = options.find((o) => o.isCorrectOrBest)

  await db_.tbGameSession.update({
    where: { id },
    data: {
      completedAt: new Date(),
      outcome: { optionId: chosen.id, wasCorrect },
      xpAwarded: FLAT_XP_PER_SESSION,
    },
  })

  await db_.tbGameLevel.upsert({
    where: { userId_gameKey: { userId: session.user.id, gameKey: gameSession.gameKey } },
    create: { userId: session.user.id, gameKey: gameSession.gameKey, xp: FLAT_XP_PER_SESSION },
    update: { xp: { increment: FLAT_XP_PER_SESSION } },
  })

  return res.json({
    wasCorrect,
    explanation: bestOption?.explanation ?? null,
    xpAwarded: FLAT_XP_PER_SESSION,
  })
}
