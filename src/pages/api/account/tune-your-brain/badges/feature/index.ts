import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// App-enforced cap of 6 featured badges per member (spec's number for a
// compact public-profile "Achievements" strip). An unearned badge can
// NEVER be featured -- verified below against TbUserBadge, never trusted
// from the client.
const MAX_FEATURED_BADGES = 6

const bodySchema = z.object({
  badgeId: z.string().min(1),
  order: z.number().int().min(0).optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" })

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const userId = session.user.id
  const { badgeId } = parsed.data

  const earned = await db.tbUserBadge.findUnique({ where: { userId_badgeId: { userId, badgeId } } })
  if (!earned) return res.status(403).json({ error: "You can only feature a badge you've earned." })

  const alreadyFeatured = await db.badgeFeature.findUnique({ where: { userId_badgeId: { userId, badgeId } } })
  if (alreadyFeatured) return res.status(200).json({ ok: true })

  const existingCount = await db.badgeFeature.count({ where: { userId } })
  if (existingCount >= MAX_FEATURED_BADGES) {
    return res.status(400).json({ error: `You can feature up to ${MAX_FEATURED_BADGES} badges. Unfeature one first.` })
  }

  const order = parsed.data.order ?? existingCount

  await db.badgeFeature.create({ data: { userId, badgeId, order } })

  return res.status(201).json({ ok: true })
}
