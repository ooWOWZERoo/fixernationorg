import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { awardPoints } from "@/lib/loyalty"

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
    findMany: (args?: Record<string, unknown>) => Promise<ReflectionRow[]>
    create: (args: Record<string, unknown>) => Promise<ReflectionRow>
  }
}

const db_ = db as never as ReflectionDb

const createSchema = z.object({
  title: z.string().max(255).optional(),
  body: z.string().min(10),
  mood: z.number().int().min(1).max(5).optional(),
  isPrivate: z.boolean().optional(),
  focusAreaId: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" })

  const userId = session.user.id

  if (req.method === "GET") {
    const { tag, focusAreaId } = req.query

    const where: Record<string, unknown> = { userId }
    if (focusAreaId && typeof focusAreaId === "string") {
      where.focusAreaId = focusAreaId
    }

    let entries = await db_.reflectionEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
    })

    // Filter by tag if provided (Postgres array contains — done in JS for simplicity)
    if (tag && typeof tag === "string") {
      entries = entries.filter((e) => e.tags.includes(tag))
    }

    return res.json({ entries: JSON.parse(JSON.stringify(entries)) })
  }

  if (req.method === "POST") {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const { title, body, mood, isPrivate, focusAreaId, tags } = parsed.data

    const entry = await db_.reflectionEntry.create({
      data: {
        userId,
        title: title ?? null,
        body,
        mood: mood ?? null,
        isPrivate: isPrivate !== false,
        focusAreaId: focusAreaId ?? null,
        tags: tags ?? [],
      },
    })

    awardPoints(userId, 10, "REFLECTION_ADDED", entry.id).catch(console.error)

    return res.status(201).json({ entry: JSON.parse(JSON.stringify(entry)) })
  }

  res.setHeader("Allow", "GET, POST")
  return res.status(405).json({ error: "Method not allowed" })
}
