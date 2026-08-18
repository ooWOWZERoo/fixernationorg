import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

type PlanDb = {
  fixerPlan: {
    findFirst: (args: { where: object; include?: object }) => Promise<PlanWithItems | null>
  }
  fixerPlanItem: {
    create: (args: { data: object }) => Promise<object>
  }
}

type PlanWithItems = {
  id: string
  userId: string
  items: { order: number }[]
}

const addItemSchema = z.object({
  type: z.enum(["CONTENT", "ACTION", "PATHWAY", "CHALLENGE", "GROUP", "PROVIDER", "BOOK", "EVENT"]),
  title: z.string().min(1).max(300),
  refId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" })

  const userId = session.user.id
  const { id } = req.query as { id: string }
  const db_ = db as never as PlanDb

  if (req.method === "POST") {
    const plan = await db_.fixerPlan.findFirst({
      where: { id, userId },
      include: { items: true },
    })
    if (!plan) return res.status(404).json({ error: "Plan not found" })

    const parsed = addItemSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const maxOrder = plan.items.length > 0
      ? Math.max(...plan.items.map((i) => i.order))
      : -1

    const item = await db_.fixerPlanItem.create({
      data: {
        planId: id,
        type: parsed.data.type,
        title: parsed.data.title,
        refId: parsed.data.refId ?? null,
        notes: parsed.data.notes ?? null,
        order: maxOrder + 1,
        status: "PENDING",
      },
    })

    return res.status(201).json({ item: JSON.parse(JSON.stringify(item)) })
  }

  res.setHeader("Allow", "POST")
  return res.status(405).json({ error: "Method not allowed" })
}
