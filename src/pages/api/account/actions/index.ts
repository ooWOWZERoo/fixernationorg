import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

type ActionDb = {
  memberAction: {
    findMany: (args: { where: object; orderBy?: object }) => Promise<ActionRow[]>
    create: (args: { data: object }) => Promise<ActionRow>
  }
}

type ActionRow = {
  id: string
  userId: string
  title: string
  description: string | null
  dueDate: Date | null
  source: string | null
  planId: string | null
  status: string
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const createSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  source: z.string().optional().nullable(),
  planId: z.string().optional().nullable(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" })

  const userId = session.user.id
  const db_ = db as never as ActionDb

  if (req.method === "GET") {
    const actions = await db_.memberAction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    })
    return res.json({ actions: JSON.parse(JSON.stringify(actions)) })
  }

  if (req.method === "POST") {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const action = await db_.memberAction.create({
      data: {
        userId,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        source: parsed.data.source ?? "manual",
        planId: parsed.data.planId ?? null,
        status: "PENDING",
      },
    })

    return res.status(201).json({ action: JSON.parse(JSON.stringify(action)) })
  }

  res.setHeader("Allow", "GET, POST")
  return res.status(405).json({ error: "Method not allowed" })
}
