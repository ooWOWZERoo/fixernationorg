import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { validateTuneBrainContentFields } from "@/lib/tuneBrainContentValidator";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

// key/gameKey/tier are deliberately absent from this schema -- they're
// structural identifiers the reward engine keys off of. Changing them
// post-hoc could silently break badge-award logic for members who already
// have history against the old values, so they're only ever set at create
// time.
const updateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().min(1).max(500).optional(),
  pointsReward: z.number().int().min(0).max(1000).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.adminRole || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.query as { id: string };
  const badge = await db.tbBadge.findUnique({
    where: { id },
    include: { _count: { select: { userBadges: true } } },
  });
  if (!badge) return res.status(404).json({ error: "Not found" });

  if (req.method === "GET") {
    return res.status(200).json(badge);
  }

  if (req.method === "PATCH") {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { name, description, pointsReward, sortOrder, isActive: requestedActive } = parsed.data;
    const nextName = name ?? badge.name;
    const nextDescription = description ?? badge.description;

    const result = validateTuneBrainContentFields([nextName, nextDescription]);
    let isActive = requestedActive ?? badge.isActive;
    if (!result.passed) {
      if (requestedActive === true) {
        return res.status(400).json({ error: "Cannot activate a badge whose copy failed validation.", validation: result });
      }
      isActive = false;
    }

    try {
      const updated = await db.tbBadge.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(pointsReward !== undefined && { pointsReward }),
          ...(sortOrder !== undefined && { sortOrder }),
          isActive,
        },
      });
      return res.status(200).json({ ...updated, validation: result });
    } catch (err: unknown) {
      console.error("Error updating Tune Your Brain badge:", err);
      return res.status(500).json({ error: "An error occurred while saving. Please try again." });
    }
  }

  res.setHeader("Allow", "GET, PATCH");
  return res.status(405).json({ error: "Method not allowed" });
}
