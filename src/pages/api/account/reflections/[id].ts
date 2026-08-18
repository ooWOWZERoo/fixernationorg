import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

type ReflectionRow = {
  id: string
  userId: string
  title: string | null
  body: string
  mood: number | null
  isPrivate: boolean
  focusAreaId: string | null
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

type ReflectionDb = {
  reflectionEntry: {
    findUnique: (args: Record<string, unknown>) => Promise<ReflectionRow | null>
    update: (args: Record<string, unknown>) => Promise<ReflectionRow>
    delete: (args: Record<string, unknown>) => Promise<ReflectionRow>
  }
}

const db_ = db as never as ReflectionDb

const updateSchema = z.object({
  title: z.string().max(255).optional(),
  body: z.string().min(10).optional(),
  mood: z.number().int().min(1).max(5).nullable().optional(),
  focusAreaId: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" })

  const { id } = req.query
  if (typeof id !== "string") return res.status(400).json({ error: "Invalid id" })

  const entry = await db_.reflectionEntry.findUnique({ where: { id } })
  if (!entry) return res.status(404).json({ error: "Not found" })
  if (entry.userId !== session.user.id) return res.status(403).json({ error: "Forbidden" })

  if (req.method === "GET") {
    return res.json({ entry: JSON.parse(JSON.stringify(entry)) })
  }

  if (req.method === "PUT") {
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const { title, body, mood, focusAreaId, tags } = parsed.data

    const data: Record<string, unknown> = {}
    if (title !== undefined) data.title = title
    if (body !== undefined) data.body = body
    if (mood !== undefined) data.mood = mood
    if (focusAreaId !== undefined) data.focusAreaId = focusAreaId
    if (tags !== undefined) data.tags = tags

    const updated = await db_.reflectionEntry.update({ where: { id }, data })
    return res.json({ entry: JSON.parse(JSON.stringify(updated)) })
  }

  if (req.method === "DELETE") {
    await db_.reflectionEntry.delete({ where: { id } })
    return res.json({ success: true })
  }

  res.setHeader("Allow", "GET, PUT, DELETE")
  return res.status(405).json({ error: "Method not allowed" })
}
