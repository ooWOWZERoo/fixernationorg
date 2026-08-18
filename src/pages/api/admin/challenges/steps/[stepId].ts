import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

type ChallengesDb = {
  challengeStep: {
    findUnique: (args: Record<string, unknown>) => Promise<unknown | null>
    update: (args: Record<string, unknown>) => Promise<unknown>
    delete: (args: Record<string, unknown>) => Promise<unknown>
  }
}
const db_ = db as never as ChallengesDb

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"]

const updateStepSchema = z.object({
  day: z.number().int().min(1).optional(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  actionPrompt: z.string().nullable().optional(),
  reflectionPrompt: z.string().nullable().optional(),
  order: z.number().int().min(0).optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.adminRole || !ADMIN_ROLES.includes(session.user.adminRole))
    return res.status(401).json({ error: "Unauthorized" })

  const { stepId } = req.query as { stepId: string }

  if (req.method === "PUT") {
    const parsed = updateStepSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const step = await db_.challengeStep.update({ where: { id: stepId }, data: parsed.data })
    return res.json(step)
  }

  if (req.method === "DELETE") {
    const existing = await db_.challengeStep.findUnique({ where: { id: stepId } })
    if (!existing) return res.status(404).json({ error: "Not found" })

    await db_.challengeStep.delete({ where: { id: stepId } })
    return res.status(204).end()
  }

  res.setHeader("Allow", "PUT, DELETE")
  return res.status(405).json({ error: "Method not allowed" })
}
