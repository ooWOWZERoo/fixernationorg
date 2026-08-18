import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

type RecommendationCountRow = {
  category: string
  _count: { id: number }
}

type FeedbackCountRow = {
  action: string
  _count: { id: number }
}

type AdminRecommendationDb = {
  recommendation: {
    groupBy: (args: Record<string, unknown>) => Promise<RecommendationCountRow[]>
  }
  recommendationFeedback: {
    groupBy: (args: Record<string, unknown>) => Promise<FeedbackCountRow[]>
  }
}

const db_ = db as never as AdminRecommendationDb

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.adminRole || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const today = new Date(new Date().toISOString().split("T")[0])

  const [byCategory, byAction] = await Promise.all([
    db_.recommendation.groupBy({
      by: ["category"],
      where: { date: today },
      _count: { id: true },
    }),
    db_.recommendationFeedback.groupBy({
      by: ["action"],
      where: {
        createdAt: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      },
      _count: { id: true },
    }),
  ])

  return res.json({
    date: today.toISOString().split("T")[0],
    byCategory: byCategory.map((r) => ({ category: r.category, count: r._count.id })),
    byAction: byAction.map((r) => ({ action: r.action, count: r._count.id })),
  })
}
