import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

type PathwaysDb = {
  pathwayEnrollment: {
    findUnique: (args: Record<string, unknown>) => Promise<unknown | null>
    update: (args: Record<string, unknown>) => Promise<unknown>
  }
  pathwayProgress: {
    upsert: (args: Record<string, unknown>) => Promise<unknown>
    count: (args?: Record<string, unknown>) => Promise<number>
  }
  pathwayStage: {
    count: (args?: Record<string, unknown>) => Promise<number>
  }
}
const db_ = db as never as PathwaysDb

const progressSchema = z.object({
  stageId: z.string().min(1),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" })

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const { enrollmentId } = req.query as { enrollmentId: string }

  const parsed = progressSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const enrollment = await db_.pathwayEnrollment.findUnique({
    where: { id: enrollmentId },
  }) as { id: string; userId: string; pathwayId: string; status: string } | null

  if (!enrollment) return res.status(404).json({ error: "Not found" })
  if (enrollment.userId !== session.user.id) return res.status(403).json({ error: "Forbidden" })
  if (enrollment.status !== "ACTIVE") return res.status(400).json({ error: "Enrollment is not active" })

  // Idempotent — upsert so duplicate completes don't create duplicates
  const progress = await db_.pathwayProgress.upsert({
    where: { enrollmentId_stageId: { enrollmentId, stageId: parsed.data.stageId } },
    create: { enrollmentId, stageId: parsed.data.stageId },
    update: {},
  })

  // Check if all stages are complete
  const [completedCount, totalStages] = await Promise.all([
    db_.pathwayProgress.count({ where: { enrollmentId } }),
    db_.pathwayStage.count({ where: { pathwayId: enrollment.pathwayId } }),
  ])

  if (completedCount >= totalStages && totalStages > 0) {
    await db_.pathwayEnrollment.update({
      where: { id: enrollmentId },
      data: { status: "COMPLETED", completedAt: new Date() },
    })
    return res.json({ progress, completed: true })
  }

  return res.json({ progress, completed: false })
}
