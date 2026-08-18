import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

type ChallengesDb = {
  challenge: {
    findUnique: (args: Record<string, unknown>) => Promise<unknown | null>
  }
  challengeEnrollment: {
    findFirst: (args: Record<string, unknown>) => Promise<unknown | null>
    create: (args: Record<string, unknown>) => Promise<unknown>
  }
}
const db_ = db as never as ChallengesDb

const enrollSchema = z.object({
  challengeId: z.string().min(1),
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

  const { challengeId } = parsed.data

  const challenge = await db_.challenge.findUnique({ where: { id: challengeId, active: true } }) as { id: string } | null
  if (!challenge) return res.status(404).json({ error: "Challenge not found" })

  const existing = await db_.challengeEnrollment.findFirst({
    where: { userId: session.user.id, challengeId, status: "ACTIVE" },
  }) as { id: string } | null
  if (existing) return res.status(409).json({ error: "Already enrolled in this challenge", enrollmentId: existing.id })

  const enrollment = await db_.challengeEnrollment.create({
    data: {
      userId: session.user.id,
      challengeId,
      status: "ACTIVE",
      currentDay: 1,
    },
  })

  return res.status(201).json(enrollment)
}
