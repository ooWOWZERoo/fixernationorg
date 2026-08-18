import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

type PathwaysDb = {
  pathwayEnrollment: {
    findFirst: (args: Record<string, unknown>) => Promise<unknown | null>
    create: (args: Record<string, unknown>) => Promise<unknown>
  }
  growthPathway: {
    findUnique: (args: Record<string, unknown>) => Promise<unknown | null>
  }
}
const db_ = db as never as PathwaysDb

const enrollSchema = z.object({
  pathwayId: z.string().min(1),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" })

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const parsed = enrollSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const { pathwayId } = parsed.data

  const pathway = await db_.growthPathway.findUnique({ where: { id: pathwayId, active: true } })
  if (!pathway) return res.status(404).json({ error: "Pathway not found" })

  // Only one ACTIVE enrollment per pathway at a time
  const existing = await db_.pathwayEnrollment.findFirst({
    where: { userId: session.user.id, pathwayId, status: "ACTIVE" },
  })
  if (existing) return res.status(409).json({ error: "Already enrolled in this pathway" })

  const enrollment = await db_.pathwayEnrollment.create({
    data: {
      userId: session.user.id,
      pathwayId,
      status: "ACTIVE",
    },
  })

  return res.status(201).json(enrollment)
}
