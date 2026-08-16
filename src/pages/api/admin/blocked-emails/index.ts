import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAction, getClientIp } from "@/lib/audit";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const addSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  reason: z.string().max(500).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    const rows = await db.blockedEmail.findMany({
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).json(rows);
  }

  if (req.method === "POST") {
    const parsed = addSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", issues: parsed.error.flatten() });
    }

    const row = await db.blockedEmail.upsert({
      where: { email: parsed.data.email },
      create: {
        email: parsed.data.email,
        reason: parsed.data.reason ?? null,
        blockedBy: session.user.email ?? session.user.id,
      },
      update: {
        reason: parsed.data.reason ?? null,
        blockedBy: session.user.email ?? session.user.id,
      },
    });

    logAction({
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: "blocked_email.added",
      resource: "BlockedEmail",
      resourceId: row.id,
      metadata: { email: parsed.data.email },
      ip: getClientIp(req),
    }).catch(console.error);

    return res.status(201).json(row);
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
