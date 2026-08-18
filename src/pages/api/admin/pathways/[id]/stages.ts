import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

type PathwaysDb = {
  pathwayStage: {
    findMany: (args?: Record<string, unknown>) => Promise<unknown[]>
    create: (args: Record<string, unknown>) => Promise<unknown>
  }
}
const db_ = db as never as PathwaysDb

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"]

const createStageSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  order: z.number().int().min(0).default(0),
  stageType: z.enum(["MORNING_BOOST", "BLOG", "RESOURCE", "CHALLENGE", "ACTION", "GROUP", "BOOK", "EVENT", "PROVIDER"]).default("ACTION"),
  contentId: z.string().optional(),
  contentTitle: z.string().optional(),
  actionPrompt: z.string().optional(),
  estimatedMinutes: z.number().int().positive().optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.adminRole || !ADMIN_ROLES.includes(session.user.adminRole))
    return res.status(401).json({ error: "Unauthorized" })

  const { id: pathwayId } = req.query as { id: string }

  if (req.method === "POST") {
    const parsed = createStageSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    // If order not supplied, append at end
    let order = parsed.data.order
    if (order === 0) {
      const existing = await db_.pathwayStage.findMany({ where: { pathwayId }, orderBy: { order: "desc" }, take: 1 }) as { order: number }[]
      order = existing.length > 0 ? existing[0].order + 1 : 0
    }

    const stage = await db_.pathwayStage.create({
      data: { ...parsed.data, order, pathwayId },
    })
    return res.status(201).json(stage)
  }

  res.setHeader("Allow", "POST")
  return res.status(405).json({ error: "Method not allowed" })
}
