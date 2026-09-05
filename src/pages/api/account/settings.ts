import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureContactForUser, setConsent } from "@/lib/contacts";

// PUSH_NOTIFICATIONS deliberately excluded -- unused today, and the site
// already has a real, working push toggle (PushNotificationToggle) backed
// by an actual browser subscription, not this consent topic.
const SELF_SERVICE_TOPICS = ["MORNING_BOOST", "CAMPAIGNS", "NEWSLETTERS", "PRODUCT_UPDATES"] as const;

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
    topic: z.enum(SELF_SERVICE_TOPICS),
    optedIn: z.boolean(),
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
    const { topic, optedIn } = parsed.data;

    if (topic === "MORNING_BOOST") {
      // Keep legacy boolean in sync for the cron fallback path
      await db.user.update({ where: { id: userId }, data: { morningBoostEmails: optedIn } });
    }

    const userRecord = await db.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    if (userRecord?.email) {
      const contactId = await ensureContactForUser(userId, userRecord.email, userRecord.name, "account_settings");
      await setConsent(contactId, topic, optedIn, "account_settings");
    }

    return res.json({ ok: true });
  }
}
