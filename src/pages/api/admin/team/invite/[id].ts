import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAction, getClientIp } from "@/lib/audit";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    return res.status(405).end();
  }

  const { id } = req.query as { id: string };

  type AdminInviteDb = {
    adminInvite: {
      findUnique: (a: unknown) => Promise<{ id: string; email: string; role: string; claimedAt: Date | null } | null>;
      delete: (a: unknown) => Promise<unknown>;
    };
  };
  const inviteDb = db as never as AdminInviteDb;

  const invite = await inviteDb.adminInvite.findUnique({ where: { id } });
  if (!invite) return res.status(404).json({ error: "Not found" });
  if (invite.claimedAt) return res.status(409).json({ error: "Invite already claimed — cannot revoke." });

  await inviteDb.adminInvite.delete({ where: { id } });

  await logAction({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "admin.invite_revoked",
    resource: "AdminInvite",
    resourceId: id,
    metadata: { email: invite.email, role: invite.role },
    ip: getClientIp(req),
  });

  return res.status(200).json({ ok: true });
}
