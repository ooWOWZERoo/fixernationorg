import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

type FocusAreaDb = {
  focusArea: {
    findUnique: (args: { where: object; include?: object }) => Promise<FocusAreaRow | null>
    update: (args: { where: object; data: object }) => Promise<FocusAreaRow>
    delete: (args: { where: object }) => Promise<FocusAreaRow>
    count: (args?: { where?: object }) => Promise<number>
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

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  order: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
})

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"]

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.adminRole || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  const { id } = req.query as { id: string }
  const db_ = db as never as FocusAreaDb

  if (req.method === "PUT") {
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const area = await db_.focusArea.update({
      where: { id },
      data: parsed.data,
    })
    return res.json({ area: JSON.parse(JSON.stringify(area)) })
  }

  if (req.method === "DELETE") {
    // Check if any members are using this focus area
    type MfaDb = { memberFocusArea: { count: (args?: { where?: object }) => Promise<number> } }
    const mfaDb = db as never as MfaDb
    const memberCount = await mfaDb.memberFocusArea.count({ where: { focusAreaId: id } })
    if (memberCount > 0) {
      return res.status(409).json({ error: `Cannot delete — ${memberCount} member(s) have this focus area selected.` })
    }

    await db_.focusArea.delete({ where: { id } })
    return res.json({ ok: true })
  }

  res.setHeader("Allow", "PUT, DELETE")
  return res.status(405).json({ error: "Method not allowed" })
}
