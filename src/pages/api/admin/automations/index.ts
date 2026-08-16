import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const createSchema = z.object({
  name: z.string().min(1).max(200),
  trigger: z.enum(["MANUAL", "SIGNUP", "ROLE_CHANGE", "TAG_ADDED", "APPLICATION_ACCEPTED"]),
  triggerConfig: z.record(z.string()).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  active: z.boolean().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    const journeys = await db.automationJourney.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { steps: true, enrollments: true } },
      },
    });

    const activeEnrollmentCounts = await db.automationEnrollment.groupBy({
      by: ["journeyId"],
      where: { status: "ACTIVE" },
      _count: { id: true },
    });

    const activeMap: Record<string, number> = {};
    for (const row of activeEnrollmentCounts) {
      activeMap[row.journeyId] = row._count.id;
    }

    return res.status(200).json(
      journeys.map((j) => ({ ...j, activeEnrollments: activeMap[j.id] ?? 0 }))
    );
  }

  if (req.method === "POST") {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", issues: parsed.error.flatten() });
    }

    const journey = await db.automationJourney.create({
      data: {
        name: parsed.data.name,
        trigger: parsed.data.trigger,
        triggerConfig: parsed.data.triggerConfig ?? Prisma.DbNull,
        description: parsed.data.description ?? null,
        active: parsed.data.active ?? false,
        createdBy: session.user.id,
      },
    });

    return res.status(201).json(journey);
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
