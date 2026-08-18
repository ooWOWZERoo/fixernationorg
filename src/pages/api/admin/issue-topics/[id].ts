import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
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
    findUnique: (args: Record<string, unknown>) => Promise<IssueTopicRow | null>
    update: (args: Record<string, unknown>) => Promise<IssueTopicRow>
    delete: (args: Record<string, unknown>) => Promise<IssueTopicRow>
  }
}

const db_ = db as never as IssueTopicsDb

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"]

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  focusAreaId: z.string().optional(),
  order: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.adminRole || !ADMIN_ROLES.includes(session.user.adminRole))
    return res.status(401).json({ error: "Unauthorized" })

  const { id } = req.query
  if (!id || typeof id !== "string") return res.status(400).json({ error: "Missing id" })

  if (req.method === "GET") {
    const topic = await db_.issueTopic.findUnique({ where: { id } })
    if (!topic) return res.status(404).json({ error: "Not found" })
    return res.json(topic)
  }

  if (req.method === "PUT") {
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const topic = await db_.issueTopic.update({
      where: { id },
      data: parsed.data,
    })
    return res.json(topic)
  }

  if (req.method === "DELETE") {
    await db_.issueTopic.delete({ where: { id } })
    return res.status(204).end()
  }

  res.setHeader("Allow", "GET, PUT, DELETE")
  return res.status(405).json({ error: "Method not allowed" })
}
