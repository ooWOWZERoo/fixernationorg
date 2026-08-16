import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const schema = z.object({
  journeyId: z.string(),
  userId: z.string().optional(),
  contactId: z.string().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", issues: parsed.error.flatten() });
  }

  const { journeyId, userId, contactId } = parsed.data;
  if (!userId && !contactId) {
    return res.status(400).json({ error: "Either userId or contactId is required" });
  }

  const journey = await db.automationJourney.findUnique({ where: { id: journeyId } });
  if (!journey) return res.status(404).json({ error: "Journey not found" });

  const enrollment = await db.automationEnrollment.create({
    data: {
      journeyId,
      userId: userId ?? null,
      contactId: contactId ?? null,
      nextRunAt: new Date(),
      events: {
        create: {
          type: "enrolled",
          metadata: { trigger: "MANUAL", enrolledBy: session.user.email },
        },
      },
    },
  });

  return res.status(201).json(enrollment);
}
