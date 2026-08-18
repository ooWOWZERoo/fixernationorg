import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

type MilestoneRow = {
  id: string
  type: string
  resourceId: string | null
  title: string
  description: string | null
  awardedAt: Date
}

type MilestoneDb = {
  memberMilestone: {
    findMany: (args?: Record<string, unknown>) => Promise<MilestoneRow[]>
    count: (args?: { where?: object }) => Promise<number>
  }
  memberRecognition: {
    count: (args?: { where?: object }) => Promise<number>
  }
}

type CheckInDb = {
  dailyCheckIn: {
    findMany: (args?: Record<string, unknown>) => Promise<{ date: Date }[]>
  }
}

type EnrollmentDb = {
  pathwayEnrollment: {
    count: (args?: { where?: object }) => Promise<number>
  }
  challengeEnrollment: {
    count: (args?: { where?: object }) => Promise<number>
  }
}

const db_ = db as never as MilestoneDb & CheckInDb & EnrollmentDb

function calculateStreak(checkIns: { date: Date }[]): number {
  if (checkIns.length === 0) return 0
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

  const userId = session.user.id

  const [
    pointsResult,
    milestonesCount,
    recentMilestones,
    activePathways,
    activeChallenges,
    recentCheckIns,
    recognitionsCount,
  ] = await Promise.all([
    db.loyaltyPoint.aggregate({ where: { userId }, _sum: { points: true } }),
    db_.memberMilestone.count({ where: { userId } }),
    db_.memberMilestone.findMany({
      where: { userId },
      orderBy: { awardedAt: "desc" },
      take: 5,
    }),
    db_.pathwayEnrollment.count({ where: { userId, status: "ACTIVE" } }),
    db_.challengeEnrollment.count({ where: { userId, status: "ACTIVE" } }),
    db_.dailyCheckIn.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 30,
    }),
    db_.memberRecognition.count({ where: { toUserId: userId } }),
  ])

  const totalPoints = pointsResult._sum.points ?? 0
  const streak = calculateStreak(recentCheckIns)

  return res.json({
    totalPoints,
    milestonesCount,
    recentMilestones: JSON.parse(JSON.stringify(recentMilestones)),
    activePathways,
    activeChallenges,
    streak,
    recognitionsCount,
  })
}
