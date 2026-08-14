import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const updateSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  phone2: z.string().optional(),
  email2: z.string().optional(),
  company: z.string().optional(),
  source: z.string().optional(),
});

const noteSchema = z.object({
  body: z.string().min(1),
});

const tagSchema = z.object({
  tag: z.string().min(1).max(64),
});

const consentSchema = z.object({
  topic: z.enum(["MORNING_BOOST", "CAMPAIGNS", "NEWSLETTERS", "PRODUCT_UPDATES"]),
  optedIn: z.boolean(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !ADMIN_ROLES.includes(session.user.role)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.query as { id: string };

  const contact = await db.contact.findUnique({
    where: { id },
    include: {
      addresses: true,
      consents: true,
      tags: { orderBy: { tag: "asc" } },
      notes: { orderBy: { createdAt: "desc" } },
      listMemberships: { include: { list: { select: { id: true, name: true } } } },
      campaignSends: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { campaign: { select: { id: true, name: true, sentAt: true } } },
      },
    },
  });

  if (!contact) return res.status(404).json({ error: "Contact not found" });

  if (req.method === "GET") {
    return res.status(200).json(contact);
  }

  if (req.method === "PUT") {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const updated = await db.contact.update({ where: { id }, data: parsed.data });
    return res.status(200).json(updated);
  }

  if (req.method === "DELETE") {
    await db.contact.delete({ where: { id } });
    return res.status(204).end();
  }

  // PATCH sub-actions: add-note, add-tag, remove-tag, set-consent
  if (req.method === "PATCH") {
    const { action } = req.body ?? {};

    if (action === "add-note") {
      const parsed = noteSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      const note = await db.contactNote.create({
        data: { contactId: id, body: parsed.data.body, authorId: session.user.id },
      });
      return res.status(201).json(note);
    }

    if (action === "add-tag") {
      const parsed = tagSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      const tag = await db.contactTag.upsert({
        where: { contactId_tag: { contactId: id, tag: parsed.data.tag } },
        create: { contactId: id, tag: parsed.data.tag },
        update: {},
      });
      return res.status(200).json(tag);
    }

    if (action === "remove-tag") {
      const parsed = tagSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      await db.contactTag.deleteMany({ where: { contactId: id, tag: parsed.data.tag } });
      return res.status(204).end();
    }

    if (action === "set-consent") {
      const parsed = consentSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      const now = new Date();
      const consent = await db.contactConsent.upsert({
        where: { contactId_topic: { contactId: id, topic: parsed.data.topic } },
        create: {
          contactId: id,
          topic: parsed.data.topic,
          optedIn: parsed.data.optedIn,
          optedInAt: parsed.data.optedIn ? now : null,
          optedOutAt: parsed.data.optedIn ? null : now,
          source: "admin",
        },
        update: {
          optedIn: parsed.data.optedIn,
          optedInAt: parsed.data.optedIn ? now : undefined,
          optedOutAt: parsed.data.optedIn ? null : now,
          source: "admin",
        },
      });
      return res.status(200).json(consent);
    }

    return res.status(400).json({ error: "Unknown action" });
  }

  res.setHeader("Allow", "GET, PUT, PATCH, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
