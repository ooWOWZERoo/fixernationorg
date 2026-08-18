import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

type ChallengesDb = {
  challengeStep: {
    findMany: (args?: Record<string, unknown>) => Promise<unknown[]>
    create: (args: Record<string, unknown>) => Promise<unknown>
  }
}
const db_ = db as never as ChallengesDb

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"]

const createStepSchema = z.object({
  day: z.number().int().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  actionPrompt: z.string().optional(),
  reflectionPrompt: z.string().optional(),
  order: z.number().int().min(0).default(0),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.adminRole || !ADMIN_ROLES.includes(session.user.adminRole))
    return res.status(401).json({ error: "Unauthorized" })

  const { id: challengeId } = req.query as { id: string }

  if (req.method === "POST") {
    const parsed = createStepSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const step = await db_.challengeStep.create({
      data: { ...parsed.data, challengeId },
    })
    return res.status(201).json(step)
  }

  res.setHeader("Allow", "POST")
  return res.status(405).json({ error: "Method not allowed" })
}
