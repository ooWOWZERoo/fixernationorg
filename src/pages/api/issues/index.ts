import type { NextApiRequest, NextApiResponse } from "next"
import { db } from "@/lib/db"

type IssueTopicRow = {
  id: string
  title: string
  slug: string
  description: string | null
  focusAreaId: string | null
  active: boolean
  order: number
  createdAt: Date
  updatedAt: Date
}

type IssueTopicsDb = {
  issueTopic: {
    findMany: (args?: Record<string, unknown>) => Promise<IssueTopicRow[]>
  }
}

const db_ = db as never as IssueTopicsDb

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const topics = await db_.issueTopic.findMany({
    where: { active: true },
    orderBy: { order: "asc" },
  })
  return res.json({ topics })
}
