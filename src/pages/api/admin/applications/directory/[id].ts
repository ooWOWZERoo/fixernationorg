import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const bodySchema = z.object({
  directoryListed: z.boolean(),
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

  const { id } = req.query as { id: string };

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", issues: parsed.error.flatten() });
  }

  const application = await db.userApplication.findUnique({
    where: { id },
    select: { id: true, type: true, status: true, directoryListed: true },
  });
  if (!application) return res.status(404).json({ error: "Not found" });

  if (application.type !== "PROVIDER") {
    return res.status(400).json({ error: "Directory listing is only available for provider applications." });
  }

  if (!["ACTIVE", "APPROVED"].includes(application.status)) {
    return res.status(400).json({ error: "Application must be Active before enabling directory listing." });
  }

  const { directoryListed } = parsed.data;

  const updated = await db.userApplication.update({
    where: { id },
    data: {
      directoryListed,
      directoryListedAt: directoryListed && !application.directoryListed ? new Date() : undefined,
    },
    select: { id: true, directoryListed: true, directoryListedAt: true },
  });

  logAction({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: directoryListed ? "application.directory_listed" : "application.directory_unlisted",
    resource: "UserApplication",
    resourceId: id,
    metadata: { directoryListed },
  }).catch(console.error);

  return res.status(200).json(updated);
}
