import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  active: z.boolean().optional(),
  triggerConfig: z.record(z.string()).optional().nullable(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id } = req.query as { id: string };

  if (req.method === "GET") {
    const journey = await db.automationJourney.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { order: "asc" } },
        _count: { select: { enrollments: true } },
      },
    });
    if (!journey) return res.status(404).json({ error: "Not found" });
    return res.status(200).json(journey);
  }

  if (req.method === "PATCH") {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", issues: parsed.error.flatten() });
    }

    const data: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.description !== undefined) data.description = parsed.data.description;
    if (parsed.data.active !== undefined) data.active = parsed.data.active;
    if (parsed.data.triggerConfig !== undefined) data.triggerConfig = parsed.data.triggerConfig;

    const journey = await db.automationJourney.update({ where: { id }, data });
    return res.status(200).json(journey);
  }

  if (req.method === "DELETE") {
    const activeCount = await db.automationEnrollment.count({
      where: { journeyId: id, status: "ACTIVE" },
    });
    if (activeCount > 0) {
      return res.status(409).json({
        error: `Cannot delete: ${activeCount} active enrollment${activeCount !== 1 ? "s" : ""}`,
      });
    }
    await db.automationJourney.delete({ where: { id } });
    return res.status(200).json({ deleted: true });
  }

  res.setHeader("Allow", "GET, PATCH, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
