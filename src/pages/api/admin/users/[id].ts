import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { UserRole } from "@prisma/client";
import { logAction, getClientIp } from "@/lib/audit";
import { autoJoinGroups } from "@/lib/groups";
import { enrollInJourneys } from "@/lib/automation";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const patchSchema = z.object({
  role: z.nativeEnum(UserRole),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id } = req.query;
  if (typeof id !== "string") return res.status(400).json({ error: "Invalid id" });

  if (id === session.user.id) {
    return res.status(400).json({ error: "You cannot change your own role." });
  }

  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid role", details: parsed.error.flatten() });
  }

  const { role } = parsed.data;

  if (["ADMIN", "SUPER_ADMIN"].includes(role) && session.user.role !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Only super admins can assign admin roles." });
  }

  const target = await db.user.findUnique({
    where: { id },
    select: { role: true, email: true },
  });
  if (!target) return res.status(404).json({ error: "User not found" });

  if (target.role === "SUPER_ADMIN" && session.user.role !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Cannot modify a super admin." });
  }

  const updated = await db.user.update({
    where: { id },
    data: { role },
    select: { id: true, role: true },
  });

  await Promise.all([
    logAction({
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: "user.role_changed",
      resource: "User",
      resourceId: id,
      metadata: { from: target.role, to: role, targetEmail: target.email },
      ip: getClientIp(req),
    }),
    autoJoinGroups(id, role),
    enrollInJourneys({ trigger: "ROLE_CHANGE", userId: id, triggerConfig: { role } }).catch(() => {}),
  ]);

  return res.status(200).json(updated);
}
