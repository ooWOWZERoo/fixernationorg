import type { NextApiRequest, NextApiResponse } from "next"
import { db } from "@/lib/db"

type PathwaysDb = {
  growthPathway: {
    findMany: (args?: Record<string, unknown>) => Promise<unknown[]>
  }
}
const db_ = db as never as PathwaysDb

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const pathways = await db_.growthPathway.findMany({
    where: { active: true },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { stages: true } },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      summary: true,
      focusAreaIds: true,
      estimatedDays: true,
      createdAt: true,
      _count: true,
    },
  })

  return res.json({ pathways })
}
