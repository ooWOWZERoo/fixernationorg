import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

type PathwaysDb = {
  pathwayEnrollment: {
    findMany: (args?: Record<string, unknown>) => Promise<unknown[]>
  }
}
const db_ = db as never as PathwaysDb

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" })

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const enrollments = await db_.pathwayEnrollment.findMany({
    where: { userId: session.user.id },
    orderBy: { startedAt: "desc" },
    include: {
      pathway: {
        include: { _count: { select: { stages: true } } },
      },
      progress: true,
    },
  })

  return res.json({ enrollments })
}
