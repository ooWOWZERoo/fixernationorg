import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { awardPoints } from "@/lib/loyalty"

type ChallengesDb = {
  challengeEnrollment: {
    findUnique: (args: Record<string, unknown>) => Promise<unknown | null>
    update: (args: Record<string, unknown>) => Promise<unknown>
  }
  challengeCompletion: {
    findUnique: (args: Record<string, unknown>) => Promise<unknown | null>
    create: (args: Record<string, unknown>) => Promise<unknown>
    count: (args?: Record<string, unknown>) => Promise<number>
  }
  challengeStep: {
    count: (args?: Record<string, unknown>) => Promise<number>
  }
}
const db_ = db as never as ChallengesDb

const completeSchema = z.object({
  stepId: z.string().min(1),
  reflection: z.string().optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" })

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const { enrollmentId } = req.query as { enrollmentId: string }

  const parsed = completeSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const { stepId, reflection } = parsed.data

  const enrollment = await db_.challengeEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { challenge: { select: { id: true, loyaltyPoints: true } } },
  }) as { id: string; userId: string; status: string; challengeId: string; challenge: { id: string; loyaltyPoints: number } } | null

  if (!enrollment) return res.status(404).json({ error: "Not found" })
  if (enrollment.userId !== session.user.id) return res.status(403).json({ error: "Forbidden" })
  if (enrollment.status !== "ACTIVE") return res.status(409).json({ error: "Enrollment is not active" })

  // Idempotent — skip if already completed
  const existing = await db_.challengeCompletion.findUnique({
    where: { enrollmentId_stepId: { enrollmentId, stepId } },
  })

  if (!existing) {
    await db_.challengeCompletion.create({
      data: { enrollmentId, stepId, reflection: reflection ?? null },
    })
  }

  // Check if all steps are now done
  const totalSteps = await db_.challengeStep.count({ where: { challengeId: enrollment.challengeId } })
  const completedCount = await db_.challengeCompletion.count({ where: { enrollmentId } })

  let nowCompleted = false
  if (totalSteps > 0 && completedCount >= totalSteps) {
    await db_.challengeEnrollment.update({
      where: { id: enrollmentId },
      data: { status: "COMPLETED", completedAt: new Date() },
    })
    nowCompleted = true

    if (enrollment.challenge.loyaltyPoints > 0) {
      awardPoints(
        enrollment.userId,
        enrollment.challenge.loyaltyPoints,
        `Challenge completed`,
        `challenge-complete-${enrollmentId}`
      ).catch(console.error)
    }
  }

  return res.json({ ok: true, completed: existing ? false : true, challengeCompleted: nowCompleted })
}
