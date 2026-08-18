import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

type PlanDb = {
  fixerPlan: {
    findFirst: (args: { where: object; include?: object }) => Promise<FixerPlanRow | null>
    findMany: (args: { where: object; orderBy?: object; include?: object; take?: number }) => Promise<FixerPlanRow[]>
    create: (args: { data: object; include?: object }) => Promise<FixerPlanRow>
    update: (args: { where: object; data: object }) => Promise<FixerPlanRow>
    updateMany: (args: { where: object; data: object }) => Promise<{ count: number }>
  }
}

type PlanItemRow = {
  id: string
  planId: string
  type: string
  refId: string | null
  title: string
  notes: string | null
  order: number
  status: string
  completedAt: Date | null
  createdAt: Date
}

type FixerPlanRow = {
  id: string
  userId: string
  title: string
  focusAreaId: string | null
  status: string
  createdAt: Date
  updatedAt: Date
  items?: PlanItemRow[]
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  focusAreaId: z.string().optional().nullable(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" })

  const userId = session.user.id
  const db_ = db as never as PlanDb

  if (req.method === "GET") {
    const [activePlan, pastPlans] = await Promise.all([
      db_.fixerPlan.findFirst({
        where: { userId, status: "ACTIVE" },
        include: { items: { orderBy: { order: "asc" } } },
      }),
      db_.fixerPlan.findMany({
        where: { userId, status: { in: ["PAUSED", "COMPLETED", "ARCHIVED"] } },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
    ])

    return res.json({
      activePlan: activePlan ? JSON.parse(JSON.stringify(activePlan)) : null,
      pastPlans: JSON.parse(JSON.stringify(pastPlans)),
    })
  }

  if (req.method === "POST") {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    // Auto-pause any current active plan
    await db_.fixerPlan.updateMany({
      where: { userId, status: "ACTIVE" },
      data: { status: "PAUSED" },
    })

    const plan = await db_.fixerPlan.create({
      data: {
        userId,
        title: parsed.data.title,
        focusAreaId: parsed.data.focusAreaId ?? null,
        status: "ACTIVE",
      },
      include: { items: true },
    })

    return res.status(201).json({ plan: JSON.parse(JSON.stringify(plan)) })
  }

  res.setHeader("Allow", "GET, POST")
  return res.status(405).json({ error: "Method not allowed" })
}
