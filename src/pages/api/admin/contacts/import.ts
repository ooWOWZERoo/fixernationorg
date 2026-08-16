import type { NextApiRequest, NextApiResponse } from "next";

export const config = {
  api: { bodyParser: { sizeLimit: "10mb" } },
};
import { getServerSession } from "next-auth";
import { z } from "zod";
import { type ContactConsentTopic } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];
const IGNORE_LABELS = ["ask the fixer"];
const ALL_TOPICS = ["MORNING_BOOST", "CAMPAIGNS", "NEWSLETTERS", "PRODUCT_UPDATES"] as const;

const AddressSchema = z.object({
  type: z.string().optional(),
  street: z.string().optional(),
  street2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

const ContactSchema = z.object({
  email: z.string().email(),
  email2: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  phone2: z.string().optional(),
  company: z.string().optional(),
  source: z.string().optional(),
  lastActivity: z.string().optional(),
  lastActivityAt: z.string().optional(),
  createdAt: z.string().optional(),
  emailSubscriberStatus: z.string().optional(),
  labels: z.array(z.string()).optional(),
  addresses: z.array(AddressSchema).optional(),
});

const ImportSchema = z.object({
  contacts: z.array(ContactSchema).min(1).max(5000),
  consentTopics: z
    .array(z.enum(["MORNING_BOOST", "CAMPAIGNS", "NEWSLETTERS", "PRODUCT_UPDATES"]))
    .optional(),
  filename: z.string().max(255).optional(),
});

type ImportBatchDb = {
  contactImportBatch: {
    create: (a: unknown) => Promise<unknown>;
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = ImportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
  }

  const { contacts, consentTopics } = parsed.data;

  // 1. Bulk insert contacts — duplicates skipped
  const result = await db.contact.createMany({
    data: contacts.map((c) => ({
      email: c.email.toLowerCase().trim(),
      email2: c.email2 || null,
      firstName: c.firstName || null,
      lastName: c.lastName || null,
      phone: c.phone || null,
      phone2: c.phone2 || null,
      company: c.company || null,
      source: c.source || "csv_import",
      lastActivity: c.lastActivity || null,
      lastActivityAt: c.lastActivityAt ? new Date(c.lastActivityAt) : null,
      ...(c.createdAt ? { createdAt: new Date(c.createdAt) } : {}),
    })),
    skipDuplicates: true,
  });

  const created = result.count;
  const existing = contacts.length - created;

  // 2. Fetch all contact records by email
  const emails = contacts.map((c) => c.email.toLowerCase().trim());
  const contactRecords = await db.contact.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true },
  });
  const emailToId = Object.fromEntries(contactRecords.map((c) => [c.email, c.id]));

  // 3. Addresses — delete existing, recreate from import data
  const allAddressData = contacts.flatMap((c) => {
    const contactId = emailToId[c.email.toLowerCase().trim()];
    if (!contactId || !c.addresses?.length) return [];
    return c.addresses.map((a, i) => ({
      contactId,
      type: a.type || null,
      street: a.street || null,
      street2: a.street2 || null,
      city: a.city || null,
      state: a.state || null,
      zip: a.zip || null,
      country: a.country || null,
      isPrimary: i === 0,
    }));
  });

  let addressesCreated = 0;
  if (allAddressData.length > 0) {
    const contactIdsWithAddresses = [...new Set(allAddressData.map((a) => a.contactId))];
    await db.contactAddress.deleteMany({
      where: { contactId: { in: contactIdsWithAddresses } },
    });
    const addrResult = await db.contactAddress.createMany({ data: allAddressData });
    addressesCreated = addrResult.count;
  }

  // 4. Consent — from emailSubscriberStatus (Wix CSV) or manual consentTopics
  const now = new Date();
  const consentData: Array<{
    contactId: string;
    topic: ContactConsentTopic;
    optedIn: boolean;
    optedInAt: Date | null;
    optedOutAt: Date | null;
    source: string;
  }> = [];

  for (const c of contacts) {
    const contactId = emailToId[c.email.toLowerCase().trim()];
    if (!contactId) continue;

    const status = c.emailSubscriberStatus?.toLowerCase().trim();
    let optedIn: boolean | null = null;
    if (status === "subscribed") optedIn = true;
    else if (status === "unsubscribed") optedIn = false;

    if (optedIn !== null) {
      for (const topic of ALL_TOPICS) {
        consentData.push({
          contactId,
          topic,
          optedIn,
          optedInAt: optedIn ? now : null,
          optedOutAt: optedIn ? null : now,
          source: "csv_import",
        });
      }
    } else if (consentTopics && consentTopics.length > 0) {
      for (const topic of consentTopics) {
        consentData.push({
          contactId,
          topic,
          optedIn: true,
          optedInAt: now,
          optedOutAt: null,
          source: "csv_import",
        });
      }
    }
  }

  let consentAdded = 0;
  if (consentData.length > 0) {
    const consentResult = await db.contactConsent.createMany({
      data: consentData,
      skipDuplicates: true,
    });
    consentAdded = consentResult.count;
  }

  // 5. Labels → ContactLists + memberships
  const allLabels = [
    ...new Set(
      contacts
        .flatMap((c) => c.labels ?? [])
        .map((l) => l.trim())
        .filter((l) => l && !IGNORE_LABELS.includes(l.toLowerCase()))
    ),
  ];

  let listMembershipsAdded = 0;

  if (allLabels.length > 0) {
    const existingLists = await db.contactList.findMany({
      where: { name: { in: allLabels }, ownerType: "FN_ADMIN" },
      select: { id: true, name: true },
    });
    const listMap: Record<string, string> = Object.fromEntries(
      existingLists.map((l) => [l.name, l.id])
    );

    for (const label of allLabels) {
      if (!listMap[label]) {
        const newList = await db.contactList.create({
          data: { name: label, ownerType: "FN_ADMIN" },
        });
        listMap[label] = newList.id;
      }
    }

    const membershipData = contacts.flatMap((c) => {
      const contactId = emailToId[c.email.toLowerCase().trim()];
      if (!contactId || !c.labels?.length) return [];
      return c.labels
        .map((l) => l.trim())
        .filter((l) => l && !IGNORE_LABELS.includes(l.toLowerCase()) && listMap[l])
        .map((l) => ({ contactId, listId: listMap[l] }));
    });

    if (membershipData.length > 0) {
      const memberResult = await db.contactListMember.createMany({
        data: membershipData,
        skipDuplicates: true,
      });
      listMembershipsAdded = memberResult.count;
    }
  }

  // Record import batch (fire-and-forget — don't fail the import if this errors)
  const batchDb = db as never as ImportBatchDb;
  batchDb.contactImportBatch.create({
    data: {
      filename: parsed.data.filename ?? null,
      totalRows: contacts.length,
      created,
      existing,
      consentAdded,
      addressesCreated,
      listMembershipsAdded,
      importedBy: session.user.id,
    },
  }).catch(() => {});

  return res.status(200).json({
    created,
    existing,
    total: contacts.length,
    consentAdded,
    addressesCreated,
    listMembershipsAdded,
  });
}
