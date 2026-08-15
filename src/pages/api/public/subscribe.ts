import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { db } from "@/lib/db";

const schema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  // Legacy: system-level consent topic (enum-based)
  topic: z.enum(["MORNING_BOOST", "CAMPAIGNS", "NEWSLETTERS", "PRODUCT_UPDATES"]).optional(),
  // New: admin-defined NewsletterTopic id or slug
  topicId: z.string().optional(),
  topicSlug: z.string().optional(),
  source: z.string().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, firstName, lastName, topic, topicId, topicSlug, source } = parsed.data;
  const now = new Date();

  // Upsert contact
  const contact = await db.contact.upsert({
    where: { email },
    create: { email, firstName, lastName, source: source ?? "subscribe" },
    update: { firstName: firstName ?? undefined, lastName: lastName ?? undefined },
  });

  const results: { consent?: boolean; subscription?: boolean } = {};

  // System consent (enum topic)
  if (topic) {
    await db.contactConsent.upsert({
      where: { contactId_topic: { contactId: contact.id, topic } },
      create: { contactId: contact.id, topic, optedIn: true, optedInAt: now, source: source ?? "subscribe" },
      update: { optedIn: true, optedInAt: now, optedOutAt: null, source: source ?? "subscribe" },
    });
    results.consent = true;
  }

  // Named newsletter topic subscription
  const resolvedTopicId = topicId ?? (topicSlug
    ? (await db.newsletterTopic.findUnique({ where: { slug: topicSlug } }))?.id
    : undefined);

  if (resolvedTopicId) {
    const newsletterTopic = await db.newsletterTopic.findUnique({ where: { id: resolvedTopicId } });
    if (!newsletterTopic || !newsletterTopic.active) {
      return res.status(400).json({ error: "Topic not found or inactive" });
    }
    await db.contactSubscription.upsert({
      where: { contactId_topicId: { contactId: contact.id, topicId: resolvedTopicId } },
      create: { contactId: contact.id, topicId: resolvedTopicId, active: true },
      update: { active: true },
    });
    results.subscription = true;
  }

  // Default: if neither topic nor topicId given, opt into general NEWSLETTERS consent
  if (!topic && !resolvedTopicId) {
    await db.contactConsent.upsert({
      where: { contactId_topic: { contactId: contact.id, topic: "NEWSLETTERS" } },
      create: { contactId: contact.id, topic: "NEWSLETTERS", optedIn: true, optedInAt: now, source: source ?? "subscribe" },
      update: { optedIn: true, optedInAt: now, optedOutAt: null, source: source ?? "subscribe" },
    });
    results.consent = true;
  }

  return res.status(200).json({ ok: true, ...results });
}
