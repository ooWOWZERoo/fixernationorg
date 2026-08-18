import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
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

type RecommendationsDb = {
  issueRecommendationMap: {
    findMany: (args?: Record<string, unknown>) => Promise<RecommendationRow[]>
    create: (args: Record<string, unknown>) => Promise<RecommendationRow>
    delete: (args: Record<string, unknown>) => Promise<RecommendationRow>
  }
}

const db_ = db as never as RecommendationsDb

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"]

const createSchema = z.object({
  recommendationType: z.enum(["PATHWAY", "CHALLENGE", "RESOURCE", "BLOG_POST"]),
  resourceId: z.string().min(1),
  resourceTitle: z.string().min(1),
  priority: z.number().int().default(0),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.adminRole || !ADMIN_ROLES.includes(session.user.adminRole))
    return res.status(401).json({ error: "Unauthorized" })

  const { id: issueTopicId } = req.query
  if (!issueTopicId || typeof issueTopicId !== "string")
    return res.status(400).json({ error: "Missing issueTopicId" })

  if (req.method === "GET") {
    const recommendations = await db_.issueRecommendationMap.findMany({
      where: { issueTopicId },
      orderBy: { priority: "desc" },
    })
    return res.json({ recommendations })
  }

  if (req.method === "POST") {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const { recommendationType, resourceId, resourceTitle, priority } = parsed.data

    try {
      const rec = await db_.issueRecommendationMap.create({
        data: { issueTopicId, recommendationType, resourceId, resourceTitle, priority },
      })
      return res.status(201).json(rec)
    } catch {
      return res.status(409).json({ error: "Recommendation already exists for this topic + type + resource" })
    }
  }

  if (req.method === "DELETE") {
    const { recommendationId } = req.query
    if (!recommendationId || typeof recommendationId !== "string")
      return res.status(400).json({ error: "Missing recommendationId" })

    await db_.issueRecommendationMap.delete({ where: { id: recommendationId } })
    return res.status(204).end()
  }

  res.setHeader("Allow", "GET, POST, DELETE")
  return res.status(405).json({ error: "Method not allowed" })
}
