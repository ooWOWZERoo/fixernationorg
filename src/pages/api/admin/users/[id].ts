import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminRole } from "@prisma/client";
import { logAction, getClientIp } from "@/lib/audit";
import { autoJoinGroups } from "@/lib/groups";
import { enrollInJourneys } from "@/lib/automation";

const STAFF_ROLES = ["ADMIN", "SUPER_ADMIN"];

// Only the 4 real membership tiers are valid here — UserRole still contains
// legacy ADMIN/SUPER_ADMIN values left over from before SP-45 split staff
// access into its own adminRole field, but this endpoint's membership-role
// branch must never be able to set them (that's what the adminRole branch,
// below, is for).
const membershipSchema = z.object({
  role: z.enum(["CONSUMER", "MEMBER", "PROVIDER", "AMBASSADOR"]),
});

const adminRoleSchema = z.object({
  adminRole: z.nativeEnum(AdminRole),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || !STAFF_ROLES.includes(session.user.adminRole)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id } = req.query;
  if (typeof id !== "string") return res.status(400).json({ error: "Invalid id" });

  if (id === session.user.id) {
    return res.status(400).json({ error: "You cannot change your own role." });
  }

  const target = await db.user.findUnique({
    where: { id },
    select: { role: true, adminRole: true, email: true },
  });
  if (!target) return res.status(404).json({ error: "User not found" });

  if (target.adminRole === "SUPER_ADMIN" && session.user.adminRole !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Cannot modify a super admin." });
  }

  // adminRole field — only SUPER_ADMIN may change this
  if ("adminRole" in req.body) {
    if (session.user.adminRole !== "SUPER_ADMIN") {
      return res.status(403).json({ error: "Only super admins can change staff access." });
    }
    const parsed = adminRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid adminRole", details: parsed.error.flatten() });
    }
    const { adminRole } = parsed.data;
    const updated = await db.user.update({
      where: { id },
      data: { adminRole },
      select: { id: true, adminRole: true },
    });
    await logAction({
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: "user.admin_role_changed",
      resource: "User",
      resourceId: id,
      metadata: { from: target.adminRole, to: adminRole, targetEmail: target.email },
      ip: getClientIp(req),
    });
    return res.status(200).json(updated);
  }

  // membership role field
  const parsed = membershipSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid role", details: parsed.error.flatten() });
  }
  const { role } = parsed.data;

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
