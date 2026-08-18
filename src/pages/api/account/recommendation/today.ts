import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { generateRecommendation } from "@/lib/recommendations"

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

type RecommendationDb = {
  recommendation: {
    findFirst: (args: Record<string, unknown>) => Promise<RecommendationRow | null>
    upsert: (args: Record<string, unknown>) => Promise<RecommendationRow>
  }
}

const db_ = db as never as RecommendationDb

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" })

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const today = new Date(new Date().toISOString().split("T")[0])

  // Check if a recommendation already exists for today
  const existing = await db_.recommendation.findFirst({
    where: { userId: session.user.id, date: today },
    include: { feedback: true },
  })
  if (existing) {
    return res.json({ recommendation: JSON.parse(JSON.stringify(existing)) })
  }

  // Generate a new recommendation
  const generated = await generateRecommendation(session.user.id)
  if (!generated) {
    return res.json({ recommendation: null })
  }

  const created = await db_.recommendation.upsert({
    where: { userId_date: { userId: session.user.id, date: today } },
    create: {
      userId: session.user.id,
      category: generated.category,
      resourceId: generated.resourceId,
      resourceTitle: generated.resourceTitle,
      resourceSlug: generated.resourceSlug ?? null,
      reason: generated.reason,
      date: today,
    },
    update: {},
    include: { feedback: true },
  })

  return res.json({ recommendation: JSON.parse(JSON.stringify(created)) })
}
