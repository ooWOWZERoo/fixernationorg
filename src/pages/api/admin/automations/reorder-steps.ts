import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const schema = z.object({
  journeyId: z.string(),
  stepIds: z.array(z.string()).min(1),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") {
    res.setHeader("Allow", "PUT");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { journeyId, stepIds } = parsed.data;

  const existing = await db.automationStep.findMany({
    where: { journeyId },
    select: { id: true },
  });

  if (stepIds.length !== existing.length) {
    return res.status(400).json({ error: "stepIds must include every step in the journey" });
  }

  const existingIds = new Set(existing.map((s) => s.id));
  if (!stepIds.every((id) => existingIds.has(id))) {
    return res.status(400).json({ error: "One or more stepIds do not belong to this journey" });
  }

  // Two-phase update to avoid @@unique([journeyId, order]) constraint violations.
  // Phase 1: move all to negative orders (guaranteed vacant).
  // Phase 2: assign final positive orders.
  await db.$transaction([
    ...stepIds.map((id, i) =>
      db.automationStep.update({ where: { id }, data: { order: -(i + 1) } })
    ),
    ...stepIds.map((id, i) =>
      db.automationStep.update({ where: { id }, data: { order: i + 1 } })
    ),
  ]);

  const updated = await db.automationStep.findMany({
    where: { journeyId },
    orderBy: { order: "asc" },
  });

  return res.status(200).json(updated);
}
