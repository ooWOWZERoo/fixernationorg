import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" })

  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const badgeId = req.query.badgeId as string
  const userId = session.user.id

  await db.badgeFeature.deleteMany({ where: { userId, badgeId } })

  return res.json({ ok: true })
}
