import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

type ChallengesDb = {
  challenge: {
    findUnique: (args: Record<string, unknown>) => Promise<unknown | null>
    update: (args: Record<string, unknown>) => Promise<unknown>
  }
}
const db_ = db as never as ChallengesDb

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"]

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  summary: z.string().optional(),
  focusAreaIds: z.array(z.string()).optional(),
  durationDays: z.number().int().positive().optional(),
  active: z.boolean().optional(),
  startMode: z.enum(["EVERGREEN", "SCHEDULED"]).optional(),
  startDate: z.string().datetime().nullable().optional(),
  enrollmentLimit: z.number().int().positive().nullable().optional(),
  loyaltyPoints: z.number().int().min(0).optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.adminRole || !ADMIN_ROLES.includes(session.user.adminRole))
    return res.status(401).json({ error: "Unauthorized" })

  const { id } = req.query as { id: string }

  if (req.method === "GET") {
    const challenge = await db_.challenge.findUnique({
      where: { id },
      include: {
        steps: { orderBy: [{ day: "asc" }, { order: "asc" }] },
        _count: { select: { enrollments: true } },
      },
    })
    if (!challenge) return res.status(404).json({ error: "Not found" })
    return res.json(JSON.parse(JSON.stringify(challenge)))
  }

  if (req.method === "PUT") {
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const data: Record<string, unknown> = { ...parsed.data }
    if (parsed.data.startDate !== undefined) {
      data.startDate = parsed.data.startDate ? new Date(parsed.data.startDate) : null
    }

    const challenge = await db_.challenge.update({ where: { id }, data })
    return res.json(JSON.parse(JSON.stringify(challenge)))
  }

  if (req.method === "DELETE") {
    await db_.challenge.update({ where: { id }, data: { active: false } })
    return res.json({ ok: true })
  }

  res.setHeader("Allow", "GET, PUT, DELETE")
  return res.status(405).json({ error: "Method not allowed" })
}
