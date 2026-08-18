import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

type MilestoneDb = {
  memberMilestone: {
    groupBy: (args: Record<string, unknown>) => Promise<{ type: string; _count: { type: number } }[]>
    count: (args?: { where?: object }) => Promise<number>
  }
}

const db_ = db as never as MilestoneDb

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.adminRole || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const [byType, total] = await Promise.all([
    db_.memberMilestone.groupBy({
      by: ["type"],
      _count: { type: true },
      orderBy: { _count: { type: "desc" } },
    }),
    db_.memberMilestone.count(),
  ])

  return res.json({ byType, total })
}
