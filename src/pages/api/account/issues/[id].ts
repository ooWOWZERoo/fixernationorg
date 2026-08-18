import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

type MemberIssueRow = {
  id: string
  userId: string
  issueTopicId: string
  description: string | null
  resolved: boolean
  createdAt: Date
  updatedAt: Date
}

type MemberIssueDb = {
  memberIssue: {
    findUnique: (args: Record<string, unknown>) => Promise<MemberIssueRow | null>
    update: (args: Record<string, unknown>) => Promise<MemberIssueRow>
    delete: (args: Record<string, unknown>) => Promise<MemberIssueRow>
  }
}

const db_ = db as never as MemberIssueDb

const updateSchema = z.object({
  resolved: z.boolean(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" })

  const userId = session.user.id
  const { id } = req.query
  if (!id || typeof id !== "string") return res.status(400).json({ error: "Missing id" })

  if (req.method === "PUT") {
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const existing = await db_.memberIssue.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: "Not found" })
    if (existing.userId !== userId) return res.status(403).json({ error: "Forbidden" })

    const updated = await db_.memberIssue.update({
      where: { id },
      data: { resolved: parsed.data.resolved },
    })
    return res.json({ issue: JSON.parse(JSON.stringify(updated)) })
  }

  if (req.method === "DELETE") {
    const existing = await db_.memberIssue.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: "Not found" })
    if (existing.userId !== userId) return res.status(403).json({ error: "Forbidden" })

    await db_.memberIssue.delete({ where: { id } })
    return res.status(204).end()
  }

  res.setHeader("Allow", "PUT, DELETE")
  return res.status(405).json({ error: "Method not allowed" })
}
