import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import type { TbGameKey } from "@prisma/client"
import { CORE_GAME_KEYS } from "@/lib/tuneBrain/registry"
import { RESET_SCOPES } from "@/lib/tuneBrain/resetConstants"
import {
  gatherResetData,
  buildResetPreview,
  neverTouchedSummary,
  ResetValidationError,
  ResetNotFoundError,
} from "@/lib/tuneBrain/reset"

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"]

const querySchema = z.object({
  userId: z.string().min(1),
  scope: z.enum(RESET_SCOPES),
  gameKey: z.enum(CORE_GAME_KEYS as [string, ...string[]]).optional(),
  badgeId: z.string().min(1).optional(),
  goalId: z.string().min(1).optional(),
})

// Read-only impact preview -- computed live from the database so the admin
// UI's "will affect" / "will NOT affect" lists are always accurate, never
// estimates. Uses the exact same gatherResetData() the execute endpoint
// uses immediately before deleting anything, so the two can never disagree.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.adminRole || !ADMIN_ROLES.includes(session.user.adminRole))
    return res.status(401).json({ error: "Unauthorized" })

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const parsed = querySchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const { userId, scope, gameKey, badgeId, goalId } = parsed.data

  // A FULL reset is destructive enough that even previewing its blast
  // radius is gated the same way executing it is -- a plain ADMIN should
  // never be able to probe what a FULL wipe would do, not just be blocked
  // from actually doing it.
  if (scope === "FULL" && session.user.adminRole !== "SUPER_ADMIN")
    return res.status(403).json({ error: "Only super admins can preview a full reset." })

  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } })
  if (!user) return res.status(404).json({ error: "Member not found" })

  try {
    const data = await gatherResetData(db, { userId, scope, gameKey: gameKey as TbGameKey | undefined, badgeId, goalId })
    return res.status(200).json({
      preview: buildResetPreview(data),
      neverTouched: neverTouchedSummary(scope),
    })
  } catch (err) {
    if (err instanceof ResetValidationError) return res.status(400).json({ error: err.message })
    if (err instanceof ResetNotFoundError) return res.status(404).json({ error: err.message })
    throw err
  }
}
