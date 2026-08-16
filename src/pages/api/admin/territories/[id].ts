import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { recordEvent } from "@/lib/application-events";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.enum(["GEOGRAPHIC", "INDUSTRY", "ORGANIZATION", "CUSTOM"]).optional(),
  scope: z.enum(["ZIP", "CITY", "COUNTY", "STATE", "REGION", "NATIONAL", "CUSTOM"]).optional(),
  county: z.string().max(120).nullish(),
  city: z.string().max(120).nullish(),
  state: z.string().max(60).nullish(),
  zip: z.string().max(10).nullish(),
  region: z.string().max(120).nullish(),
  description: z.string().max(1000).nullish(),
  status: z.enum(["ACTIVE", "RESERVED", "LOCKED", "INACTIVE"]).optional(),
  isExclusive: z.boolean().optional(),
  notes: z.string().max(2000).nullish(),
});

const assignSchema = z.object({
  action: z.literal("assign"),
  applicationId: z.string(),
  userId: z.string().optional(),
  notes: z.string().max(1000).optional(),
  endDate: z.string().optional(),
  autoRenew: z.boolean().default(true),
});

const revokeSchema = z.object({
  action: z.literal("revoke"),
  assignmentId: z.string(),
  notes: z.string().max(1000).optional(),
});

const actionSchema = z.discriminatedUnion("action", [assignSchema, revokeSchema]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id } = req.query as { id: string };

  // ── GET ────────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    const territory = await db.territory.findUnique({
      where: { id },
      include: {
        assignments: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            application: { select: { id: true, name: true, email: true, type: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!territory) return res.status(404).json({ error: "Not found" });
    return res.status(200).json(territory);
  }

  // ── PATCH — update territory fields OR assign/revoke ──────────────────────
  if (req.method === "PATCH") {
    const territory = await db.territory.findUnique({ where: { id } });
    if (!territory) return res.status(404).json({ error: "Not found" });

    // Action-based operations (assign / revoke)
    if (req.body?.action) {
      const parsed = actionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }

      if (parsed.data.action === "assign") {
        const { applicationId, userId, notes, endDate, autoRenew } = parsed.data;

        // Verify application exists and is AMBASSADOR type
        const application = await db.userApplication.findUnique({
          where: { id: applicationId },
          select: { id: true, type: true, userId: true },
        });
        if (!application) return res.status(404).json({ error: "Application not found" });
        if (application.type !== "AMBASSADOR") {
          return res.status(400).json({ error: "Territory assignment is only for ambassador applications" });
        }

        const resolvedUserId = userId ?? application.userId ?? undefined;

        const assignment = await db.territoryAssignment.create({
          data: {
            territoryId: id,
            userId: resolvedUserId,
            applicationId,
            notes: notes?.trim() || null,
            endDate: endDate ? new Date(endDate) : null,
            autoRenew,
            assignedBy: session.user.email ?? session.user.id,
          },
          include: {
            territory: true,
            user: { select: { id: true, name: true, email: true } },
          },
        });

        recordEvent(applicationId, "TERRITORY_ASSIGNED", session.user.email, {
          territoryId: id,
          territoryName: assignment.territory?.name ?? id,
        }).catch((err) => console.error("[events] TERRITORY_ASSIGNED record failed:", err));

        return res.status(201).json(assignment);
      }

      if (parsed.data.action === "revoke") {
        const { assignmentId, notes } = parsed.data;

        const existing = await db.territoryAssignment.findUnique({
          where: { id: assignmentId },
          include: { territory: { select: { name: true } } },
        });
        if (!existing) return res.status(404).json({ error: "Assignment not found" });
        if (existing.status === "REVOKED") {
          return res.status(409).json({ error: "Already revoked" });
        }

        const revoked = await db.territoryAssignment.update({
          where: { id: assignmentId },
          data: {
            status: "REVOKED",
            revokedAt: new Date(),
            revokedBy: session.user.email,
            notes: notes?.trim() || existing.notes,
          },
        });

        if (existing.applicationId) {
          recordEvent(existing.applicationId, "TERRITORY_REVOKED", session.user.email, {
            territoryId: id,
            territoryName: existing.territory?.name ?? id,
          }).catch((err) => console.error("[events] TERRITORY_REVOKED record failed:", err));
        }

        return res.status(200).json(revoked);
      }
    }

    // Field updates
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const updated = await db.territory.update({ where: { id }, data: parsed.data });
    return res.status(200).json(updated);
  }

  res.setHeader("Allow", "GET, PATCH");
  return res.status(405).json({ error: "Method not allowed" });
}
