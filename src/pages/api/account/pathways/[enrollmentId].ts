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
}
const db_ = db as never as PathwaysDb

const updateSchema = z.object({
  status: z.enum(["PAUSED", "WITHDRAWN"]),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" })

  if (req.method !== "PUT") {
    res.setHeader("Allow", "PUT")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const { enrollmentId } = req.query as { enrollmentId: string }

  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const enrollment = await db_.pathwayEnrollment.findUnique({
    where: { id: enrollmentId },
  }) as { id: string; userId: string } | null

  if (!enrollment) return res.status(404).json({ error: "Not found" })
  if (enrollment.userId !== session.user.id) return res.status(403).json({ error: "Forbidden" })

  const updated = await db_.pathwayEnrollment.update({
    where: { id: enrollmentId },
    data: {
      status: parsed.data.status,
      ...(parsed.data.status === "WITHDRAWN" ? { completedAt: new Date() } : {}),
    },
  })

  return res.json(updated)
}
