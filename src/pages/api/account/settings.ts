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
    const optedIn = parsed.data.morningBoostEmails;
    const now = new Date();

    // Keep legacy boolean in sync for the cron fallback path
    await db.user.update({
      where: { id: userId },
      data: { morningBoostEmails: optedIn },
    });

    // Find or create a Contact linked to this user
    const userRecord = await db.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, crmContact: { select: { id: true } } },
    });

    let contactId = userRecord?.crmContact?.id ?? null;

    if (!contactId && userRecord?.email) {
      // Check if a subscriber Contact with this email exists (no userId yet)
      const emailContact = await db.contact.findUnique({
        where: { email: userRecord.email },
        select: { id: true, userId: true },
      });

      if (emailContact && !emailContact.userId) {
        // Link the existing subscriber Contact to this account
        await db.contact.update({ where: { id: emailContact.id }, data: { userId } });
        contactId = emailContact.id;
      } else if (!emailContact) {
        const nameParts = (userRecord.name ?? "").trim().split(/\s+/);
        const contact = await db.contact.create({
          data: {
            email: userRecord.email,
            firstName: nameParts[0] || null,
            lastName: nameParts.slice(1).join(" ") || null,
            userId,
            source: "account_settings",
          },
        });
        contactId = contact.id;
      }
    }

    if (contactId) {
      await db.contactConsent.upsert({
        where: { contactId_topic: { contactId, topic: "MORNING_BOOST" } },
        create: {
          contactId,
          topic: "MORNING_BOOST",
          optedIn,
          optedInAt: optedIn ? now : null,
          optedOutAt: optedIn ? null : now,
          source: "account_settings",
        },
        update: {
          optedIn,
          optedInAt: optedIn ? now : undefined,
          optedOutAt: optedIn ? null : now,
          source: "account_settings",
        },
      });
    }

    return res.json({ ok: true });
  }
}
