import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAction, getClientIp } from "@/lib/audit";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id } = req.query as { id: string };

  const row = await db.blockedEmail.findUnique({ where: { id } });
  if (!row) return res.status(404).json({ error: "Not found" });

  await db.blockedEmail.delete({ where: { id } });

  logAction({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "blocked_email.removed",
    resource: "BlockedEmail",
    resourceId: id,
    metadata: { email: row.email },
    ip: getClientIp(req),
  }).catch(console.error);

  return res.status(200).json({ removed: true, email: row.email });
}
