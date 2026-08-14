import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const ContactSchema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  source: z.string().optional(),
});

const ImportSchema = z.object({
  contacts: z.array(ContactSchema).min(1).max(5000),
  consentTopics: z
    .array(z.enum(["MORNING_BOOST", "CAMPAIGNS", "NEWSLETTERS", "PRODUCT_UPDATES"]))
    .optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !ADMIN_ROLES.includes(session.user.role)) {
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

  // Bulk insert contacts — duplicates (same email) are skipped
  const result = await db.contact.createMany({
    data: contacts.map((c) => ({
      email: c.email.toLowerCase().trim(),
      firstName: c.firstName || null,
      lastName: c.lastName || null,
      phone: c.phone || null,
      company: c.company || null,
      source: c.source || "csv_import",
    })),
    skipDuplicates: true,
  });

  const created = result.count;
  const existing = contacts.length - created;

  let consentAdded = 0;

  if (consentTopics && consentTopics.length > 0) {
    // Fetch contact IDs for all uploaded emails
    const emails = contacts.map((c) => c.email.toLowerCase().trim());
    const contactRecords = await db.contact.findMany({
      where: { email: { in: emails } },
      select: { id: true },
    });

    const now = new Date();
    const consentRows = contactRecords.flatMap((c) =>
      consentTopics.map((topic) => ({
        contactId: c.id,
        topic,
        optedIn: true as const,
        optedInAt: now,
        source: "csv_import",
      }))
    );

    const consentResult = await db.contactConsent.createMany({
      data: consentRows,
      skipDuplicates: true,
    });
    consentAdded = consentResult.count;
  }

  return res.status(200).json({
    created,
    existing,
    total: contacts.length,
    consentAdded,
  });
}
