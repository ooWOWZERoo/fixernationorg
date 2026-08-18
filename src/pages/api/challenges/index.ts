import type { NextApiRequest, NextApiResponse } from "next"
import { db } from "@/lib/db"

type ChallengesDb = {
  challenge: {
    findMany: (args?: Record<string, unknown>) => Promise<unknown[]>
  }
}
const db_ = db as never as ChallengesDb

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const challenges = await db_.challenge.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { enrollments: true, steps: true } } },
  })

  return res.json({ challenges: JSON.parse(JSON.stringify(challenges)) })
}
