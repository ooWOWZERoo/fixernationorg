import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];
const Schema = z.object({ password: z.string().min(8, "Password must be at least 8 characters") });

// Direct password set for account recovery when the reset-link flow isn't
// practical (e.g. outgoing email is down, or a phone handoff is preferred).
// The admin types the value into their own browser here — this endpoint
// only ever receives it from that one legitimate first-party form.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id } = req.query as { id: string };
  if (id === session.user.id) {
    return res.status(400).json({ error: "Use your own account settings to change your own password." });
  }

  const target = await db.user.findUnique({ where: { id }, select: { id: true, email: true, adminRole: true } });
  if (!target) return res.status(404).json({ error: "User not found" });

  // Same restriction already applied to editing adminRole in this UI: only
  // a Super Admin can act on another Super Admin's account.
  if (target.adminRole === "SUPER_ADMIN" && session.user.adminRole !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Only a Super Admin can set another Super Admin's password." });
  }

  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid password" });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await db.user.update({ where: { id }, data: { passwordHash } });

  // Invalidate any pending reset link for THIS account so an old link
  // (e.g. one generated earlier while email was down) can't later
  // overwrite the password an admin just deliberately set.
  await db.verificationToken.deleteMany({ where: { identifier: `reset:${target.email}` } }).catch(() => {});

  return res.status(200).json({ ok: true });
}
