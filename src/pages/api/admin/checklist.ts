import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { logAction } from "@/lib/audit";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const putSchema = z.object({
  applicationId: z.string().min(1),
  key: z.string().min(1).max(80),
  status: z.enum(["PENDING", "PASSED", "FAILED", "NOT_APPLICABLE", "ADDITIONAL_DOCS_REQUIRED"]),
  notes: z.string().max(1000).nullish(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method !== "PUT") {
    res.setHeader("Allow", "PUT");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = putSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", issues: parsed.error.flatten() });
  }

  const { applicationId, key, status, notes } = parsed.data;

  const application = await db.userApplication.findUnique({
    where: { id: applicationId },
    select: { id: true },
  });
  if (!application) {
    return res.status(404).json({ error: "Application not found" });
  }

  const item = await db.checklistItem.upsert({
    where: { applicationId_key: { applicationId, key } },
    update: {
      status,
      notes: notes ?? null,
      updatedBy: session.user.email,
    },
    create: {
      applicationId,
      key,
      status,
      notes: notes ?? null,
      updatedBy: session.user.email,
    },
  });

  logAction({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: `checklist.${key}.${status.toLowerCase()}`,
    resource: "UserApplication",
    resourceId: applicationId,
    metadata: { key, status, notes: notes ?? null },
  }).catch(console.error);

  return res.status(200).json(item);
}
