import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { db } from "@/lib/db";

const schema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  topic: z.enum(["MORNING_BOOST", "CAMPAIGNS", "NEWSLETTERS", "PRODUCT_UPDATES"]).default("NEWSLETTERS"),
  source: z.string().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, firstName, lastName, topic, source } = parsed.data;
  const now = new Date();

  // Upsert contact
  const contact = await db.contact.upsert({
    where: { email },
    create: { email, firstName, lastName, source: source ?? "subscribe" },
    update: { firstName: firstName ?? undefined, lastName: lastName ?? undefined },
  });

  // Upsert consent
  await db.contactConsent.upsert({
    where: { contactId_topic: { contactId: contact.id, topic } },
    create: { contactId: contact.id, topic, optedIn: true, optedInAt: now, source: source ?? "subscribe" },
    update: { optedIn: true, optedInAt: now, optedOutAt: null, source: source ?? "subscribe" },
  });

  return res.status(200).json({ ok: true });
}
