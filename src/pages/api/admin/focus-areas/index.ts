import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

type FocusAreaDb = {
  focusArea: {
    findMany: (args?: { orderBy?: object }) => Promise<FocusAreaRow[]>
    create: (args: { data: object }) => Promise<FocusAreaRow>
  }
}

type FocusAreaRow = {
  id: string
  name: string
  order: number
  active: boolean
  createdAt: Date
  updatedAt: Date
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  order: z.number().int().min(0).optional(),
})

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"]

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.adminRole || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  if (req.method === "GET") {
    const db_ = db as never as FocusAreaDb
    const areas = await db_.focusArea.findMany({ orderBy: { order: "asc" } as object })
    return res.json({ areas: JSON.parse(JSON.stringify(areas)) })
  }

  if (req.method === "POST") {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const db_ = db as never as FocusAreaDb
    const area = await db_.focusArea.create({
      data: {
        name: parsed.data.name,
        order: parsed.data.order ?? 0,
        active: true,
      },
    })
    return res.status(201).json({ area: JSON.parse(JSON.stringify(area)) })
  }

  res.setHeader("Allow", "GET, POST")
  return res.status(405).json({ error: "Method not allowed" })
}
