import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

type CheckInDb = {
  dailyCheckIn: {
    count: (args?: Record<string, unknown>) => Promise<number>
    groupBy: (args: Record<string, unknown>) => Promise<unknown[]>
  }
}
const db_ = db as never as CheckInDb

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"]

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.adminRole || !ADMIN_ROLES.includes(session.user.adminRole))
    return res.status(401).json({ error: "Unauthorized" })

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const now = new Date()
  now.setUTCHours(0, 0, 0, 0)

  const todayCount = await db_.dailyCheckIn.count({
    where: { date: now },
  })

  // Last 7 days daily counts
  const days: { date: string; count: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() - i)
    const next = new Date(d)
    next.setUTCDate(next.getUTCDate() + 1)
    const count = await db_.dailyCheckIn.count({
      where: { date: { gte: d, lt: next } },
    })
    days.push({ date: d.toISOString().split("T")[0], count })
  }

  return res.json({ todayCount, days })
}
