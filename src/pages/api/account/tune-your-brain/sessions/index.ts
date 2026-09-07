import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import type { TbGameKey } from "@prisma/client"
import { TB_GAME_REGISTRY } from "@/lib/tuneBrain/registry"

// Simple recency exclusion -- excludes content the user has seen in their
// last few sessions for this game. The full 90-day-exclusion sophistication
// from positivityBoost.ts is a later refinement.
const RECENT_EXCLUSION_COUNT = 5

// Every registry key is a valid, playable core game -- generalized from
// Phase 1's single z.literal("POSITIVE_REFRAME"), which was the
// Positive-Reframe-specific hardcoding this phase's extensibility goal
// required fixing. `category` is optional and lets a game with multiple
// distinct modes (Calm & Focus's "breathing" vs "notice") ask for a
// specific one instead of a random pick across all its content.
const bodySchema = z.object({
  gameKey: z.enum(Object.keys(TB_GAME_REGISTRY) as [string, ...string[]]),
  category: z.string().min(1).optional(),
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

  // The zod enum is built from Object.keys() (plain strings), so this cast
  // is validated by construction -- every registry key is a real
  // TbGameKey value, and z.enum already rejected anything else above.
  const gameKey = parsed.data.gameKey as TbGameKey
  const category = parsed.data.category
  const userId = session.user.id

  const recentSessions = await db.tbGameSession.findMany({
    where: { userId, gameKey },
    orderBy: { createdAt: "desc" },
    take: RECENT_EXCLUSION_COUNT,
    select: { contentItemId: true },
  })
  const recentIds = recentSessions
    .map((s) => s.contentItemId)
    .filter((id): id is string => !!id)

  const baseWhere = {
    gameKey,
    status: "ACTIVE" as const,
    validationStatus: "PASSED" as const,
    ...(category ? { category } : {}),
  }

  let candidates = await db.tbContentItem.findMany({
    where: { ...baseWhere, ...(recentIds.length > 0 ? { id: { notIn: recentIds } } : {}) },
    include: { options: { orderBy: { order: "asc" } } },
  })

  if (candidates.length === 0) {
    // Recency-exclusion pool exhausted (or a thin-content game like Calm &
    // Focus has fewer rows than the exclusion window) -- fall back to the
    // full eligible pool for this gameKey/category.
    candidates = await db.tbContentItem.findMany({
      where: baseWhere,
      include: { options: { orderBy: { order: "asc" } } },
    })
  }

  if (candidates.length === 0) {
    return res.status(503).json({ error: "No content available for this game right now." })
  }

  const chosen = candidates[Math.floor(Math.random() * candidates.length)]

  const gameSession = await db.tbGameSession.create({
    data: { userId, gameKey, contentItemId: chosen.id },
  })

  // Kindness Quest's "accept" step is the session-start itself -- creating
  // the TbKindnessMission row here (acceptedAt now, completedAt null) is
  // the one game-specific side effect this generic route needs; the
  // completion side of that game is handled entirely by its own dedicated
  // mark-done route, not this one.
  if (gameKey === "KINDNESS_QUEST") {
    await db.tbKindnessMission.create({
      data: { userId, contentItemId: chosen.id, sessionId: gameSession.id },
    })
  }

  // Never return isCorrectOrBest/explanation before completion -- that's
  // server-authoritative and evaluated only in the complete endpoint.
  return res.status(201).json({
    sessionId: gameSession.id,
    contentItem: {
      id: chosen.id,
      prompt: chosen.prompt,
      difficulty: chosen.difficulty,
      category: chosen.category,
      payload: chosen.payload,
      options: chosen.options.map((o) => ({ id: o.id, label: o.label })),
    },
  })
}
