import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { setConsent } from "@/lib/contacts";

const schema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  topic: z.enum(["MORNING_BOOST", "CAMPAIGNS", "NEWSLETTERS", "PRODUCT_UPDATES"]).optional(),
  source: z.string().optional(),
  _hp: z.string().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Honeypot: silently succeed if bot filled in the hidden field
  if (req.body?._hp) return res.status(200).json({ ok: true });

  const rl = await checkRateLimit(`sub:${getClientIp(req)}`, 15, 60 * 60 * 1000);
  if (!rl.allowed) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, firstName, lastName, topic, source } = parsed.data;

  // Upsert contact — name fields only set on create; never overwrite an existing contact's name
  const contact = await db.contact.upsert({
    where: { email },
    create: { email, firstName, lastName, source: source ?? "subscribe" },
    update: {},
  });

  // Attribution: only set on first touch (upsert with no-op update preserves original)
  db.contactAttribution.upsert({
    where: { contactId: contact.id },
    create: { contactId: contact.id, source: "SUBSCRIBE_FORM" },
    update: {},
  }).catch(() => {});

  // Add to "Newsletter Subscribers" list — find-or-create the list, then upsert membership
  (async () => {
    let list = await db.contactList.findFirst({
      where: { name: "Newsletter Subscribers", ownerType: "FN_ADMIN" },
    });
    if (!list) {
      try {
        list = await db.contactList.create({
          data: { name: "Newsletter Subscribers", ownerType: "FN_ADMIN" },
        });
      } catch {
        list = await db.contactList.findFirst({
          where: { name: "Newsletter Subscribers", ownerType: "FN_ADMIN" },
        });
      }
    }
    if (list) {
      await db.contactListMember.upsert({
        where: { listId_contactId: { listId: list.id, contactId: contact.id } },
        create: { listId: list.id, contactId: contact.id },
        update: {},
      });
    }
  })().catch(() => {});

  // Default to general NEWSLETTERS consent when no specific topic is given.
  await setConsent(contact.id, topic ?? "NEWSLETTERS", true, source ?? "subscribe");

  return res.status(200).json({ ok: true });
}
