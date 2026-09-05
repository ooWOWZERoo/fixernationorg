import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncMorningBoostList } from "@/lib/contacts";

// One-time backfill: create Contact + MORNING_BOOST ContactConsent for every verified
// user that doesn't already have a linked Contact. Safe to run multiple times.

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const users = await db.user.findMany({
    where: {
      emailVerified: { not: null },
      crmContact: null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      morningBoostEmails: true,
      createdAt: true,
    },
  });

  let created = 0;
  let linked = 0;
  let consentCreated = 0;
  let skipped = 0;
  const touchedContactIds: string[] = [];

  for (const user of users) {
    let contactId: string | null = null;

    // Try to find a subscriber Contact with the same email (no userId yet)
    const emailContact = await db.contact.findUnique({
      where: { email: user.email },
      select: { id: true, userId: true },
    });

    if (emailContact) {
      if (!emailContact.userId) {
        await db.contact.update({
          where: { id: emailContact.id },
          data: { userId: user.id },
        });
        contactId = emailContact.id;
        linked++;
      } else {
        // Email belongs to a Contact already linked to a different user — skip
        skipped++;
        continue;
      }
    } else {
      const nameParts = (user.name ?? "").trim().split(/\s+/);
      try {
        const contact = await db.contact.create({
          data: {
            email: user.email,
            firstName: nameParts[0] || null,
            lastName: nameParts.slice(1).join(" ") || null,
            userId: user.id,
            source: "backfill",
            createdAt: user.createdAt,
          },
        });
        contactId = contact.id;
        created++;
      } catch {
        skipped++;
        continue;
      }
    }

    // Create MORNING_BOOST consent only if one doesn't exist yet
    const existing = await db.contactConsent.findUnique({
      where: { contactId_topic: { contactId, topic: "MORNING_BOOST" } },
    });

    if (!existing) {
      await db.contactConsent.create({
        data: {
          contactId,
          topic: "MORNING_BOOST",
          optedIn: user.morningBoostEmails,
          optedInAt: user.morningBoostEmails ? user.createdAt : null,
          source: "backfill",
        },
      });
      consentCreated++;
    }
    touchedContactIds.push(contactId);
  }

  await syncMorningBoostList(touchedContactIds);

  return res.status(200).json({
    usersProcessed: users.length,
    contactsCreated: created,
    contactsLinked: linked,
    consentRowsCreated: consentCreated,
    skipped,
  });
}
