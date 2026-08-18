import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

type PlanItemDb = {
  fixerPlanItem: {
    findFirst: (args: { where: object; include?: object }) => Promise<ItemWithPlan | null>
    update: (args: { where: object; data: object }) => Promise<object>
  }
}

type ItemWithPlan = {
  id: string
  plan: { userId: string }
}

const updateItemSchema = z.object({
  status: z.enum(["PENDING", "COMPLETED", "SKIPPED"]).optional(),
  order: z.number().int().min(0).optional(),
  notes: z.string().nullable().optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" })

  const userId = session.user.id
  const { itemId } = req.query as { itemId: string }
  const db_ = db as never as PlanItemDb

  if (req.method === "PUT") {
    const item = await db_.fixerPlanItem.findFirst({
      where: { id: itemId },
      include: { plan: true },
    })
    if (!item || item.plan.userId !== userId) {
      return res.status(404).json({ error: "Item not found" })
    }

    const parsed = updateItemSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const completedAt =
      parsed.data.status === "COMPLETED" ? new Date() :
      parsed.data.status === "PENDING" ? null :
      undefined

    const updated = await db_.fixerPlanItem.update({
      where: { id: itemId },
      data: {
        ...(parsed.data.status !== undefined && { status: parsed.data.status }),
        ...(parsed.data.order !== undefined && { order: parsed.data.order }),
        ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
        ...(completedAt !== undefined && { completedAt }),
      },
    })

    return res.json({ item: JSON.parse(JSON.stringify(updated)) })
  }

  res.setHeader("Allow", "PUT")
  return res.status(405).json({ error: "Method not allowed" })
}
