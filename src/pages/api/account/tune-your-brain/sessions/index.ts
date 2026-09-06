import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// Simple recency exclusion for Phase 1 -- excludes content the user has seen
// in their last few sessions for this game. The full 90-day-exclusion
// sophistication from positivityBoost.ts is a later refinement.
const RECENT_EXCLUSION_COUNT = 5

type TbContentItemRow = {
  id: string
  prompt: string
  difficulty: number | null
  category: string | null
  options: Array<{ id: string; order: number; label: string }>
}

type TbSessionsDb = {
  tbContentItem: {
    findMany: (args: Record<string, unknown>) => Promise<TbContentItemRow[]>
  }
  tbGameSession: {
    findMany: (args: Record<string, unknown>) => Promise<Array<{ contentItemId: string | null }>>
    create: (args: Record<string, unknown>) => Promise<{ id: string }>
  }
}
const db_ = db as never as TbSessionsDb

const bodySchema = z.object({
  gameKey: z.literal("POSITIVE_REFRAME"),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" })

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const { gameKey } = parsed.data
  const userId = session.user.id

  const recentSessions = await db_.tbGameSession.findMany({
    where: { userId, gameKey },
    orderBy: { createdAt: "desc" },
    take: RECENT_EXCLUSION_COUNT,
    select: { contentItemId: true },
  })
  const recentIds = recentSessions
    .map((s) => s.contentItemId)
    .filter((id): id is string => !!id)

  let candidates = await db_.tbContentItem.findMany({
    where: {
      gameKey,
      status: "ACTIVE",
      validationStatus: "PASSED",
      ...(recentIds.length > 0 ? { id: { notIn: recentIds } } : {}),
    },
    include: { options: { orderBy: { order: "asc" } } },
  })

  if (candidates.length === 0) {
    // Recency-exclusion pool exhausted -- fall back to the full eligible pool.
    candidates = await db_.tbContentItem.findMany({
      where: { gameKey, status: "ACTIVE", validationStatus: "PASSED" },
      include: { options: { orderBy: { order: "asc" } } },
    })
  }

  if (candidates.length === 0) {
    return res.status(503).json({ error: "No content available for this game right now." })
  }

  const chosen = candidates[Math.floor(Math.random() * candidates.length)]

  const gameSession = await db_.tbGameSession.create({
    data: { userId, gameKey, contentItemId: chosen.id },
  })

  // Never return isCorrectOrBest/explanation before completion -- that's
  // server-authoritative and evaluated only in the complete endpoint.
  return res.status(201).json({
    sessionId: gameSession.id,
    contentItem: {
      id: chosen.id,
      prompt: chosen.prompt,
      difficulty: chosen.difficulty,
      category: chosen.category,
      options: chosen.options.map((o) => ({ id: o.id, label: o.label })),
    },
  })
}
