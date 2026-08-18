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
  }
}

const db_ = db as never as MilestoneDb

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" })

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const milestones = await db_.memberMilestone.findMany({
    where: { userId: session.user.id },
    orderBy: { awardedAt: "desc" },
  })

  return res.json({ milestones: JSON.parse(JSON.stringify(milestones)) })
}
