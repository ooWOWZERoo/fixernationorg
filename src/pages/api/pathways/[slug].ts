import type { NextApiRequest, NextApiResponse } from "next"
import { db } from "@/lib/db"

type PathwaysDb = {
  growthPathway: {
    findUnique: (args: Record<string, unknown>) => Promise<unknown | null>
  }
}
const db_ = db as never as PathwaysDb

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const { slug } = req.query as { slug: string }

  const pathway = await db_.growthPathway.findUnique({
    where: { slug, active: true },
    include: {
      stages: { orderBy: { order: "asc" } },
    },
  })

  if (!pathway) return res.status(404).json({ error: "Not found" })
  return res.json(pathway)
}
