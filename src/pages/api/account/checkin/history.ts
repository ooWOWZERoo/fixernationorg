import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

type CheckInDb = {
  dailyCheckIn: {
    findMany: (args?: Record<string, unknown>) => Promise<unknown[]>
  }
}
const db_ = db as never as CheckInDb

interface CheckInRow {
  date: string
  mood: number
  energy: number
  note: string | null
  focusAreaId: string | null
  createdAt: string
}

function calculateStreak(checkIns: CheckInRow[]): number {
  if (checkIns.length === 0) return 0

  // checkIns are ordered by date DESC
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  let streak = 0
  let cursor = new Date(today)

  for (const ci of checkIns) {
    const d = new Date(ci.date)
    d.setUTCHours(0, 0, 0, 0)
    const diffDays = Math.round((cursor.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0 || diffDays === 1) {
      streak++
      cursor = d
    } else {
      break
    }
  }

  return streak
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" })

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const raw = await db_.dailyCheckIn.findMany({
    where: { userId: session.user.id },
    orderBy: { date: "desc" },
    take: 30,
  }) as { date: Date; mood: number; energy: number; note: string | null; focusAreaId: string | null; createdAt: Date }[]

  const checkIns: CheckInRow[] = raw.map((ci) => ({
    date: ci.date instanceof Date ? ci.date.toISOString() : String(ci.date),
    mood: ci.mood,
    energy: ci.energy,
    note: ci.note,
    focusAreaId: ci.focusAreaId,
    createdAt: ci.createdAt instanceof Date ? ci.createdAt.toISOString() : String(ci.createdAt),
  }))

  const streak = calculateStreak(checkIns)

  return res.json({ checkIns, streak })
}
