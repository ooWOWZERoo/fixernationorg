import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

type PlanDb = {
  fixerPlan: {
    findFirst: (args: { where: object }) => Promise<{ id: string; userId: string } | null>
    update: (args: { where: object; data: object }) => Promise<object>
  }
}

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  focusAreaId: z.string().nullable().optional(),
  status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]).optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" })

  const userId = session.user.id
  const { id } = req.query as { id: string }
  const db_ = db as never as PlanDb

  if (req.method === "PUT") {
    const plan = await db_.fixerPlan.findFirst({ where: { id, userId } })
    if (!plan) return res.status(404).json({ error: "Plan not found" })

    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const updated = await db_.fixerPlan.update({
      where: { id },
      data: {
        ...(parsed.data.title !== undefined && { title: parsed.data.title }),
        ...(parsed.data.focusAreaId !== undefined && { focusAreaId: parsed.data.focusAreaId }),
        ...(parsed.data.status !== undefined && { status: parsed.data.status }),
      },
    })

    return res.json({ plan: JSON.parse(JSON.stringify(updated)) })
  }

  if (req.method === "DELETE") {
    const plan = await db_.fixerPlan.findFirst({ where: { id, userId } })
    if (!plan) return res.status(404).json({ error: "Plan not found" })

    const archived = await db_.fixerPlan.update({
      where: { id },
      data: { status: "ARCHIVED" },
    })
    return res.json({ plan: JSON.parse(JSON.stringify(archived)) })
  }

  res.setHeader("Allow", "PUT, DELETE")
  return res.status(405).json({ error: "Method not allowed" })
}
