import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const createSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(["GEOGRAPHIC", "INDUSTRY", "ORGANIZATION", "CUSTOM"]).default("GEOGRAPHIC"),
  scope: z.enum(["ZIP", "CITY", "COUNTY", "STATE", "REGION", "NATIONAL", "CUSTOM"]).default("COUNTY"),
  county: z.string().max(120).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(60).optional(),
  zip: z.string().max(10).optional(),
  region: z.string().max(120).optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(["ACTIVE", "RESERVED", "LOCKED", "INACTIVE"]).default("ACTIVE"),
  isExclusive: z.boolean().default(false),
  notes: z.string().max(2000).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // ── GET — list territories ─────────────────────────────────────────────────
  if (req.method === "GET") {
    const { type, status, state, scope, q } = req.query as Record<string, string>;

    const territories = await db.territory.findMany({
      where: {
        ...(type && { type: type as "GEOGRAPHIC" | "INDUSTRY" | "ORGANIZATION" | "CUSTOM" }),
        ...(status && { status: status as "ACTIVE" | "RESERVED" | "LOCKED" | "INACTIVE" }),
        ...(state && { state }),
        ...(scope && { scope: scope as "ZIP" | "CITY" | "COUNTY" | "STATE" | "REGION" | "NATIONAL" | "CUSTOM" }),
        ...(q && {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { county: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
          ],
        }),
      },
      include: {
        _count: { select: { assignments: { where: { status: "ACTIVE" } } } },
      },
      orderBy: [{ state: "asc" }, { name: "asc" }],
      take: 200,
    });

    return res.status(200).json(territories);
  }

  // ── POST — create territory ────────────────────────────────────────────────
  if (req.method === "POST") {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const territory = await db.territory.create({ data: parsed.data });
    return res.status(201).json(territory);
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
