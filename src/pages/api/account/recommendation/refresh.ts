import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { generateRecommendation } from "@/lib/recommendations"

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
  feedback: { id: string; action: string; createdAt: Date } | null
}

type RecommendationDb = {
  recommendation: {
    deleteMany: (args: { where: object }) => Promise<{ count: number }>
    create: (args: { data: object; include?: object }) => Promise<RecommendationRow>
  }
}

const db_ = db as never as RecommendationDb

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" })

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const today = new Date(new Date().toISOString().split("T")[0])
  const userId = session.user.id

  // Delete today's existing recommendation
  await db_.recommendation.deleteMany({ where: { userId, date: today } })

  // Generate a fresh one
  const generated = await generateRecommendation(userId)
  if (!generated) {
    return res.json({ recommendation: null })
  }

  const created = await db_.recommendation.create({
    data: {
      userId,
      category: generated.category,
      resourceId: generated.resourceId,
      resourceTitle: generated.resourceTitle,
      resourceSlug: generated.resourceSlug ?? null,
      reason: generated.reason,
      date: today,
    },
    include: { feedback: true },
  })

  return res.json({ recommendation: JSON.parse(JSON.stringify(created)) })
}
