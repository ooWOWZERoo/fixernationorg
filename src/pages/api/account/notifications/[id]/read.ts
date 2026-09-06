import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" })

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const { id } = req.query as { id: string }

  const notification = await db.notification.findUnique({ where: { id } })
  if (!notification) return res.status(404).json({ error: "Not found" })
  if (notification.userId !== session.user.id) return res.status(403).json({ error: "Forbidden" })

  await db.notification.updateMany({ where: { id, readAt: null }, data: { readAt: new Date() } })

  return res.json({ ok: true })
}
