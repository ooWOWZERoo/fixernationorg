import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const PutSchema = z.union([
  z.object({
    action: z.literal("name"),
    name: z.string().min(1).max(100),
  }),
  z.object({
    action: z.literal("password"),
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
  }),
  z.object({
    action: z.literal("emailPrefs"),
    morningBoostEmails: z.boolean(),
  }),
]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== "PUT") {
    res.setHeader("Allow", "PUT");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = PutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
  }

  const userId = session.user.id;

  if (parsed.data.action === "name") {
    await db.user.update({ where: { id: userId }, data: { name: parsed.data.name } });
    return res.json({ ok: true });
  }

  if (parsed.data.action === "password") {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user?.passwordHash) {
      return res.status(400).json({ error: "No password set on this account." });
    }
    const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(400).json({ error: "Current password is incorrect." });
    }
    const hash = await bcrypt.hash(parsed.data.newPassword, 12);
    await db.user.update({ where: { id: userId }, data: { passwordHash: hash } });
    return res.json({ ok: true });
  }

  if (parsed.data.action === "emailPrefs") {
    await db.user.update({
      where: { id: userId },
      data: { morningBoostEmails: parsed.data.morningBoostEmails },
    });
    return res.json({ ok: true });
  }
}
