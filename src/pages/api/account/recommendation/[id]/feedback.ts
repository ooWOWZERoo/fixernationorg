import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { awardPoints } from "@/lib/loyalty"

type RecommendationFeedbackRow = {
  id: string
  action: string
  createdAt: Date
}

type RecommendationRow = {
  id: string
  userId: string
  category: string
  resourceId: string
  resourceTitle: string
  resourceSlug: string | null
  reason: string | null
  date: Date
  createdAt: Date
  feedback: RecommendationFeedbackRow | null
}

type FeedbackDb = {
  recommendation: {
    findUnique: (args: Record<string, unknown>) => Promise<RecommendationRow | null>
  }
  recommendationFeedback: {
    upsert: (args: Record<string, unknown>) => Promise<RecommendationFeedbackRow>
    findUnique: (args: Record<string, unknown>) => Promise<RecommendationFeedbackRow | null>
  }
}

const db_ = db as never as FeedbackDb

const schema = z.object({
  action: z.enum(["ACTED", "SKIPPED", "SAVED"]),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" })

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const { id } = req.query
  if (typeof id !== "string") return res.status(400).json({ error: "Invalid id" })

  const recommendation = await db_.recommendation.findUnique({
    where: { id },
    include: { feedback: true },
  })
  if (!recommendation) return res.status(404).json({ error: "Not found" })
  if (recommendation.userId !== session.user.id) return res.status(403).json({ error: "Forbidden" })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const { action } = parsed.data

  await db_.recommendationFeedback.upsert({
    where: { recommendationId: id },
    create: { recommendationId: id, action },
    update: { action },
  })

  // Award points when acted — fire and forget
  if (action === "ACTED") {
    awardPoints(session.user.id, 10, "Acted on today's recommendation", recommendation.resourceId).catch(() => {})
  }

  const updated = await db_.recommendation.findUnique({
    where: { id },
    include: { feedback: true },
  })

  return res.json({ recommendation: JSON.parse(JSON.stringify(updated)) })
}
