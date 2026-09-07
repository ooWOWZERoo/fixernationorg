import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { z } from "zod"
import type { Prisma, TbGameKey } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { getClientIp } from "@/lib/audit"
import { CORE_GAME_KEYS } from "@/lib/tuneBrain/registry"
import { RESET_SCOPES, RESET_REASONS } from "@/lib/tuneBrain/resetConstants"
import {
  TB_RESET_POINT_REASON,
  gatherResetData,
  buildResetPreview,
  performResetDeletes,
  auditActionForScope,
  ResetValidationError,
  ResetNotFoundError,
} from "@/lib/tuneBrain/reset"

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"]

const bodySchema = z
  .object({
    userId: z.string().min(1),
    scope: z.enum(RESET_SCOPES),
    gameKey: z.enum(CORE_GAME_KEYS as [string, ...string[]]).optional(),
    badgeId: z.string().min(1).optional(),
    goalId: z.string().min(1).optional(),
    reason: z.enum(RESET_REASONS),
    note: z.string().trim().max(1000).optional(),
  })
  .refine((v) => v.reason !== "OTHER" || (v.note && v.note.length > 0), {
    message: "A note is required when reason is Other.",
    path: ["note"],
  })
  .refine((v) => v.scope !== "SINGLE_GAME" || !!v.gameKey, {
    message: "gameKey is required for a SINGLE_GAME reset.",
    path: ["gameKey"],
  })
  .refine((v) => v.scope !== "BADGE" || !!v.badgeId, {
    message: "badgeId is required for a BADGE reset.",
    path: ["badgeId"],
  })

// Executes a Tune Your Brain admin reset (SP-TB-P5). This is the most
// destructive admin action in the codebase -- it deletes real gameplay
// history and reverses real Community Points -- so every step here is
// deliberate:
//
// 1. The impact is always recomputed fresh, right here, against the same
//    transaction that's about to do the deleting. The client's earlier
//    preview fetch is never trusted or even read from the request body.
// 2. The point-reversal LoyaltyPoint rows are written inside the SAME
//    $transaction as the deletions -- unlike a normal gameplay point
//    award (which is correctly fire-and-forget, after commit), a reset's
//    reversal is part of the destructive operation itself and must be
//    atomic with it.
// 3. The AuditLog row is also written inside the transaction, not via the
//    usual fire-and-forget logAction() helper -- each reversal row's
//    resourceId points back to this audit log's id (so a reversal is
//    always traceable to the reset that caused it), and that id has to
//    exist before the reversal rows are created. Doing this transactionally
//    is a deliberate deviation from logAction()'s normal after-commit
//    convention, made because the resourceId linkage needs to be atomic
//    with everything else, not because logAction() itself is wrong.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.adminRole || !ADMIN_ROLES.includes(session.user.adminRole))
    return res.status(401).json({ error: "Unauthorized" })

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const { userId, scope, gameKey, badgeId, goalId, reason, note } = parsed.data

  // FULL is SUPER_ADMIN-only per the plan; every other scope is available
  // to any Admin/Super Admin via the base ADMIN_ROLES gate above.
  if (scope === "FULL" && session.user.adminRole !== "SUPER_ADMIN")
    return res.status(403).json({ error: "Only super admins can perform a full reset." })

  const targetUser = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true } })
  if (!targetUser) return res.status(404).json({ error: "Member not found" })

  try {
    const result = await db.$transaction(async (tx) => {
      const data = await gatherResetData(tx, { userId, scope, gameKey: gameKey as TbGameKey | undefined, badgeId, goalId })
      const preview = buildResetPreview(data)

      await performResetDeletes(tx, { userId, scope, gameKey: gameKey as TbGameKey | undefined, badgeId, goalId }, data)

      const auditLog = await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          actorEmail: session.user.email,
          action: auditActionForScope(scope),
          resource: "User",
          resourceId: userId,
          metadata: {
            scope,
            gameKey: gameKey ?? null,
            badgeId: badgeId ?? null,
            goalId: goalId ?? null,
            reason,
            note: note ?? null,
            preview,
            pointsReversed: preview.pointsToReverse,
            actorAdminRole: session.user.adminRole,
            targetEmail: targetUser.email,
          } as unknown as Prisma.InputJsonValue,
          ip: getClientIp(req),
        },
      })

      if (data.loyaltyRowsToReverse.length > 0) {
        await tx.loyaltyPoint.createMany({
          data: data.loyaltyRowsToReverse.map((r) => ({
            userId,
            points: -Math.abs(r.points),
            reason: TB_RESET_POINT_REASON,
            resourceId: auditLog.id,
          })),
        })
      }

      return { preview, auditLogId: auditLog.id }
    })

    return res.status(200).json({
      ok: true,
      summary: `Reset complete: ${result.preview.sessionsAffected} session${result.preview.sessionsAffected === 1 ? "" : "s"}, ${result.preview.badgesAffected.length} badge${result.preview.badgesAffected.length === 1 ? "" : "s"}, ${result.preview.goalsAffected} goal${result.preview.goalsAffected === 1 ? "" : "s"}, ${result.preview.pointsToReverse} point${result.preview.pointsToReverse === 1 ? "" : "s"} reversed.`,
      preview: result.preview,
      auditLogId: result.auditLogId,
    })
  } catch (err) {
    if (err instanceof ResetValidationError) return res.status(400).json({ error: err.message })
    if (err instanceof ResetNotFoundError) return res.status(404).json({ error: err.message })
    throw err
  }
}
