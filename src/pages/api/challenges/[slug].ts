import type { NextApiRequest, NextApiResponse } from "next"
import { db } from "@/lib/db"

type ChallengesDb = {
  challenge: {
    findUnique: (args: Record<string, unknown>) => Promise<unknown | null>
  }
}
const db_ = db as never as ChallengesDb

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const { slug } = req.query as { slug: string }

  const challenge = await db_.challenge.findUnique({
    where: { slug },
    include: {
      steps: { orderBy: [{ day: "asc" }, { order: "asc" }] },
      _count: { select: { enrollments: true } },
    },
  })

  if (!challenge) return res.status(404).json({ error: "Not found" })

  return res.json(JSON.parse(JSON.stringify(challenge)))
}
