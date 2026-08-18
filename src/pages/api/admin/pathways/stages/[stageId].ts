import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

type PathwaysDb = {
  pathwayStage: {
    findUnique: (args: Record<string, unknown>) => Promise<unknown | null>
    update: (args: Record<string, unknown>) => Promise<unknown>
    delete: (args: Record<string, unknown>) => Promise<unknown>
  }
}
const db_ = db as never as PathwaysDb

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"]

const updateStageSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  order: z.number().int().min(0).optional(),
  stageType: z.enum(["MORNING_BOOST", "BLOG", "RESOURCE", "CHALLENGE", "ACTION", "GROUP", "BOOK", "EVENT", "PROVIDER"]).optional(),
  contentId: z.string().nullable().optional(),
  contentTitle: z.string().nullable().optional(),
  actionPrompt: z.string().nullable().optional(),
  estimatedMinutes: z.number().int().positive().nullable().optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.adminRole || !ADMIN_ROLES.includes(session.user.adminRole))
    return res.status(401).json({ error: "Unauthorized" })

  const { stageId } = req.query as { stageId: string }

  if (req.method === "PUT") {
    const parsed = updateStageSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const stage = await db_.pathwayStage.update({ where: { id: stageId }, data: parsed.data })
    return res.json(stage)
  }

  if (req.method === "DELETE") {
    const existing = await db_.pathwayStage.findUnique({ where: { id: stageId } })
    if (!existing) return res.status(404).json({ error: "Not found" })

    await db_.pathwayStage.delete({ where: { id: stageId } })
    return res.status(204).end()
  }

  res.setHeader("Allow", "PUT, DELETE")
  return res.status(405).json({ error: "Method not allowed" })
}
