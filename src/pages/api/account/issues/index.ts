import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { awardPoints } from "@/lib/loyalty"

type IssueTopicRow = {
  id: string
  title: string
  slug: string
}

type MemberIssueRow = {
  id: string
  userId: string
  issueTopicId: string
  description: string | null
  resolved: boolean
  createdAt: Date
  updatedAt: Date
  issueTopic: IssueTopicRow
}

type MemberIssueDb = {
  memberIssue: {
    findMany: (args?: Record<string, unknown>) => Promise<MemberIssueRow[]>
    create: (args: Record<string, unknown>) => Promise<MemberIssueRow>
  }
}

const db_ = db as never as MemberIssueDb

const createSchema = z.object({
  issueTopicId: z.string().min(1),
  description: z.string().max(2000).optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" })

  const userId = session.user.id

  if (req.method === "GET") {
    const issues = await db_.memberIssue.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { issueTopic: true },
    })
    return res.json({ issues: JSON.parse(JSON.stringify(issues)) })
  }

  if (req.method === "POST") {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const { issueTopicId, description } = parsed.data

    const issue = await db_.memberIssue.create({
      data: {
        userId,
        issueTopicId,
        description: description ?? null,
      },
    })

    awardPoints(userId, 5, "ISSUE_LOGGED", issue.id).catch(console.error)

    return res.status(201).json({ issue: JSON.parse(JSON.stringify(issue)) })
  }

  res.setHeader("Allow", "GET, POST")
  return res.status(405).json({ error: "Method not allowed" })
}
