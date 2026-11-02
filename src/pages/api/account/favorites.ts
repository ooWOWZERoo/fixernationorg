import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { isMember } from "@/lib/access"
import { getFavoriteIds } from "@/lib/favorites"
import { checkRateLimit, isRateLimitBypassed } from "@/lib/rate-limit"

const typeSchema = z.enum(["blog", "boost"])

const postSchema = z.object({
  type: typeSchema,
  itemId: z.string().min(1).max(100),
  favorited: z.boolean(),
})

// Favorites are private per-member bookmarks, not a financial, consent,
// security, or admin action, so they deliberately write no audit rows.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" })
  if (!isMember(session.user.role, session.user.adminRole)) {
    return res.status(403).json({ error: "Members only" })
  }

  const userId = session.user.id

  if (req.method === "GET") {
    const type = typeSchema.safeParse(req.query.type)
    if (!type.success) return res.status(400).json({ error: "type must be blog or boost" })
    const ids = await getFavoriteIds(userId, type.data)
    return res.json({ ids })
  }

  if (req.method === "POST") {
    const parsed = postSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
    const { type, itemId, favorited } = parsed.data

    if (!isRateLimitBypassed(req)) {
      const rl = await checkRateLimit(`fav:${userId}`, 60, 60 * 1000)
      if (!rl.allowed) return res.status(429).json({ error: "Too many requests. Please try again later." })
    }

    if (!favorited) {
      if (type === "blog") {
        await db.blogFavorite.deleteMany({ where: { userId, blogPostId: itemId } })
      } else {
        await db.morningBoostFavorite.deleteMany({ where: { userId, morningBoostId: itemId } })
      }
      return res.json({ ok: true, favorited: false })
    }

    if (type === "blog") {
      const post = await db.blogPost.findFirst({
        where: { id: itemId, publishedAt: { not: null } },
        select: { id: true },
      })
      if (!post) return res.status(404).json({ error: "Not found" })
      await db.blogFavorite.createMany({
        data: [{ userId, blogPostId: itemId }],
        skipDuplicates: true,
      })
    } else {
      const now = new Date()
      const tomorrowStartUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
      const boost = await db.morningBoost.findFirst({
        where: { id: itemId, publishedAt: { not: null, lt: tomorrowStartUtc } },
        select: { id: true },
      })
      if (!boost) return res.status(404).json({ error: "Not found" })
      await db.morningBoostFavorite.createMany({
        data: [{ userId, morningBoostId: itemId }],
        skipDuplicates: true,
      })
    }
    return res.json({ ok: true, favorited: true })
  }

  res.setHeader("Allow", "GET, POST")
  return res.status(405).json({ error: "Method not allowed" })
}
