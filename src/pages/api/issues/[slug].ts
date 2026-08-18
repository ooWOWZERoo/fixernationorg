import type { NextApiRequest, NextApiResponse } from "next"
import { db } from "@/lib/db"

type RecommendationRow = {
  id: string
  issueTopicId: string
  recommendationType: string
  resourceId: string
  resourceTitle: string
  priority: number
  createdAt: Date
}

type IssueTopicWithRecs = {
  id: string
  title: string
  slug: string
  description: string | null
  focusAreaId: string | null
  active: boolean
  order: number
  createdAt: Date
  updatedAt: Date
  recommendationMaps: RecommendationRow[]
}

type IssueTopicsDb = {
  issueTopic: {
    findUnique: (args: Record<string, unknown>) => Promise<IssueTopicWithRecs | null>
  }
}

const db_ = db as never as IssueTopicsDb

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const { slug } = req.query
  if (!slug || typeof slug !== "string") return res.status(400).json({ error: "Missing slug" })

  const topic = await db_.issueTopic.findUnique({
    where: { slug },
    include: {
      recommendationMaps: {
        orderBy: { priority: "desc" },
      },
    },
  })

  if (!topic) return res.status(404).json({ error: "Not found" })
  return res.json(topic)
}
