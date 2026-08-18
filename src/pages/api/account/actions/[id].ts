import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

type ActionDb = {
  memberAction: {
    findFirst: (args: { where: object }) => Promise<{ id: string; userId: string } | null>
    update: (args: { where: object; data: object }) => Promise<object>
    delete: (args: { where: object }) => Promise<object>
  }
}

const updateSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  status: z.enum(["PENDING", "COMPLETED", "SKIPPED"]).optional(),
  planId: z.string().nullable().optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" })

  const userId = session.user.id
  const { id } = req.query as { id: string }
  const db_ = db as never as ActionDb

  const action = await db_.memberAction.findFirst({ where: { id, userId } })
  if (!action) return res.status(404).json({ error: "Action not found" })

  if (req.method === "PUT") {
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const completedAt =
      parsed.data.status === "COMPLETED" ? new Date() :
      parsed.data.status === "PENDING" ? null :
      undefined

    const updated = await db_.memberAction.update({
      where: { id },
      data: {
        ...(parsed.data.title !== undefined && { title: parsed.data.title }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description }),
        ...(parsed.data.dueDate !== undefined && {
          dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        }),
        ...(parsed.data.status !== undefined && { status: parsed.data.status }),
        ...(parsed.data.planId !== undefined && { planId: parsed.data.planId }),
        ...(completedAt !== undefined && { completedAt }),
      },
    })

    return res.json({ action: JSON.parse(JSON.stringify(updated)) })
  }

  if (req.method === "DELETE") {
    await db_.memberAction.delete({ where: { id } })
    return res.json({ ok: true })
  }

  res.setHeader("Allow", "PUT, DELETE")
  return res.status(405).json({ error: "Method not allowed" })
}
