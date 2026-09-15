import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { awardPoints } from "@/lib/loyalty"
import { enrollInJourneys } from "@/lib/automation"

type CheckInDb = {
  dailyCheckIn: {
    findUnique: (args: Record<string, unknown>) => Promise<unknown | null>
    upsert: (args: Record<string, unknown>) => Promise<unknown>
    findMany: (args: Record<string, unknown>) => Promise<{ date: Date }[]>
  }
}
const db_ = db as never as CheckInDb

const CHECKIN_STREAK_MILESTONES = [7, 30, 100]

// Consecutive daily-check-in run ending the day before `date` — used to
// detect when today's check-in crosses a streak milestone.
async function computePrevStreak(userId: string, date: Date): Promise<number> {
  const lookbackStart = new Date(date)
  lookbackStart.setUTCDate(lookbackStart.getUTCDate() - (Math.max(...CHECKIN_STREAK_MILESTONES) + 5))

  const rows = await db_.dailyCheckIn.findMany({
    where: { userId, date: { gte: lookbackStart, lt: date } },
    select: { date: true },
  })
  const dateKeys = new Set(rows.map((r) => new Date(r.date).toISOString().slice(0, 10)))

  let streak = 0
  const cursor = new Date(date)
  cursor.setUTCDate(cursor.getUTCDate() - 1)
  while (dateKeys.has(cursor.toISOString().slice(0, 10))) {
    streak++
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  return streak
}

const bodySchema = z.object({
  mood: z.number().int().min(1).max(5),
  energy: z.number().int().min(1).max(5),
  note: z.string().max(1000).optional(),
  focusAreaId: z.string().optional(),
})

function todayDate(): Date {
  const d = new Date()
  // Strip time — store as midnight UTC so DATE column comparison is stable
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" })

  const userId = session.user.id
  const date = todayDate()

  if (req.method === "GET") {
    const checkIn = await db_.dailyCheckIn.findUnique({
      where: { userId_date: { userId, date } },
    })
    return res.json({ checkIn: checkIn ? JSON.parse(JSON.stringify(checkIn)) : null })
  }

  if (req.method === "POST") {
    const parsed = bodySchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const { mood, energy, note, focusAreaId } = parsed.data

    // Check if this is a new check-in (for loyalty award)
    const existing = await db_.dailyCheckIn.findUnique({
      where: { userId_date: { userId, date } },
    }) as { id: string } | null

    const checkIn = await db_.dailyCheckIn.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, mood, energy, note: note ?? null, focusAreaId: focusAreaId ?? null },
      update: { mood, energy, note: note ?? null, focusAreaId: focusAreaId ?? null },
    }) as { id: string }

    // Award 5 points only on first check-in of the day
    if (!existing) {
      awardPoints(userId, 5, "DAILY_CHECKIN", checkIn.id).catch(console.error)

      const prevStreak = await computePrevStreak(userId, date)
      const newStreak = prevStreak + 1
      for (const milestone of CHECKIN_STREAK_MILESTONES) {
        if (prevStreak < milestone && newStreak >= milestone) {
          enrollInJourneys({
            trigger: "DAILY_CHECKIN_STREAK" as never,
            userId,
            triggerConfig: { days: String(milestone) },
          }).catch(() => {})
        }
      }
    }

    return res.json({ checkIn: JSON.parse(JSON.stringify(checkIn)) })
  }

  res.setHeader("Allow", "GET, POST")
  return res.status(405).json({ error: "Method not allowed" })
}
