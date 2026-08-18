import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

type PathwaysDb = {
  growthPathway: {
    findUnique: (args: Record<string, unknown>) => Promise<unknown | null>
    update: (args: Record<string, unknown>) => Promise<unknown>
  }
}
const db_ = db as never as PathwaysDb

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"]

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  summary: z.string().optional(),
  focusAreaIds: z.array(z.string()).optional(),
  estimatedDays: z.number().int().positive().optional(),
  active: z.boolean().optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.adminRole || !ADMIN_ROLES.includes(session.user.adminRole))
    return res.status(401).json({ error: "Unauthorized" })

  const { id } = req.query as { id: string }

  if (req.method === "GET") {
    const pathway = await db_.growthPathway.findUnique({
      where: { id },
      include: {
        stages: { orderBy: { order: "asc" } },
        _count: { select: { enrollments: true } },
      },
    })
    if (!pathway) return res.status(404).json({ error: "Not found" })
    return res.json(pathway)
  }

  if (req.method === "PUT") {
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const pathway = await db_.growthPathway.update({
      where: { id },
      data: parsed.data,
    })
    return res.json(pathway)
  }

  res.setHeader("Allow", "GET, PUT")
  return res.status(405).json({ error: "Method not allowed" })
}
