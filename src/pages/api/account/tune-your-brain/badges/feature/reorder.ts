import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

const bodySchema = z.object({
  badgeIds: z.array(z.string().min(1)).max(6),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" })

  if (req.method !== "PUT") {
    res.setHeader("Allow", "PUT")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const userId = session.user.id
  const { badgeIds } = parsed.data

  // Only allow reordering badges that are actually already featured by
  // this member -- a client sending an unfamiliar badgeId just gets
  // silently ignored below, not used to sneak a new feature in via this
  // route (feature/unfeature happens only through the dedicated routes).
  const existing = await db.badgeFeature.findMany({ where: { userId } })
  const existingIds = new Set(existing.map((f) => f.badgeId))
  const validOrdered = badgeIds.filter((id) => existingIds.has(id))

  await db.$transaction(
    validOrdered.map((badgeId, index) =>
      db.badgeFeature.update({ where: { userId_badgeId: { userId, badgeId } }, data: { order: index } })
    )
  )

  return res.json({ ok: true })
}
