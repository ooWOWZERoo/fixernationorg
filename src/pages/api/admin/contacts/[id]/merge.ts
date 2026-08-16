import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

type SubDb = {
  contactSubscription: {
    findMany: (a: unknown) => Promise<{ id: string; topicId: string }[]>;
    deleteMany: (a: unknown) => Promise<unknown>;
    updateMany: (a: unknown) => Promise<unknown>;
  };
};

type IdDb = {
  contactIdentity: {
    updateMany: (a: unknown) => Promise<unknown>;
  };
};

type MergeDb = {
  contactMergeHistory: {
    create: (a: unknown) => Promise<unknown>;
  };
};

type AttrDb = {
  contactAttribution: {
    findUnique: (a: unknown) => Promise<{ id: string } | null>;
    update: (a: unknown) => Promise<unknown>;
  };
};

const bodySchema = z.object({ sourceId: z.string().min(1) });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const survivorId = (req.query as { id: string }).id;
  const { sourceId } = parsed.data;

  if (survivorId === sourceId) {
    return res.status(400).json({ error: "Cannot merge a contact into itself" });
  }

  const [survivor, source] = await Promise.all([
    db.contact.findUnique({ where: { id: survivorId }, select: { id: true, email: true } }),
    db.contact.findUnique({ where: { id: sourceId }, select: { id: true, email: true } }),
  ]);

  if (!survivor) return res.status(404).json({ error: "Survivor contact not found" });
  if (!source) return res.status(404).json({ error: "Source contact not found" });

  // ── ContactTag — @@unique([contactId, tag]) ──────────────────────────────
  const [survivorTags, sourceTags] = await Promise.all([
    db.contactTag.findMany({ where: { contactId: survivorId }, select: { tag: true } }),
    db.contactTag.findMany({ where: { contactId: sourceId }, select: { id: true, tag: true } }),
  ]);
  const survivorTagSet = new Set(survivorTags.map((t) => t.tag));
  const duplicateTagIds = sourceTags.filter((t) => survivorTagSet.has(t.tag)).map((t) => t.id);
  if (duplicateTagIds.length > 0) {
    await db.contactTag.deleteMany({ where: { id: { in: duplicateTagIds } } });
  }
  await db.contactTag.updateMany({ where: { contactId: sourceId }, data: { contactId: survivorId } });

  // ── ContactListMember — @@unique([listId, contactId]) ───────────────────
  const [survivorLists, sourceLists] = await Promise.all([
    db.contactListMember.findMany({ where: { contactId: survivorId }, select: { listId: true } }),
    db.contactListMember.findMany({ where: { contactId: sourceId }, select: { id: true, listId: true } }),
  ]);
  const survivorListSet = new Set(survivorLists.map((m) => m.listId));
  const duplicateListIds = sourceLists.filter((m) => survivorListSet.has(m.listId)).map((m) => m.id);
  if (duplicateListIds.length > 0) {
    await db.contactListMember.deleteMany({ where: { id: { in: duplicateListIds } } });
  }
  await db.contactListMember.updateMany({ where: { contactId: sourceId }, data: { contactId: survivorId } });

  // ── ContactConsent — @@unique([contactId, topic]) ───────────────────────
  const [survivorConsents, sourceConsents] = await Promise.all([
    db.contactConsent.findMany({ where: { contactId: survivorId }, select: { topic: true } }),
    db.contactConsent.findMany({ where: { contactId: sourceId }, select: { id: true, topic: true } }),
  ]);
  const survivorConsentSet = new Set(survivorConsents.map((c) => c.topic));
  const duplicateConsentIds = sourceConsents.filter((c) => survivorConsentSet.has(c.topic)).map((c) => c.id);
  if (duplicateConsentIds.length > 0) {
    await db.contactConsent.deleteMany({ where: { id: { in: duplicateConsentIds } } });
  }
  await db.contactConsent.updateMany({ where: { contactId: sourceId }, data: { contactId: survivorId } });

  // ── CampaignSend — @@unique([campaignId, contactId]) ────────────────────
  const [survivorSends, sourceSends] = await Promise.all([
    db.campaignSend.findMany({ where: { contactId: survivorId }, select: { campaignId: true } }),
    db.campaignSend.findMany({ where: { contactId: sourceId }, select: { id: true, campaignId: true } }),
  ]);
  const survivorSendSet = new Set(survivorSends.map((s) => s.campaignId));
  const duplicateSendIds = sourceSends.filter((s) => survivorSendSet.has(s.campaignId)).map((s) => s.id);
  if (duplicateSendIds.length > 0) {
    await db.campaignSend.deleteMany({ where: { id: { in: duplicateSendIds } } });
  }
  await db.campaignSend.updateMany({ where: { contactId: sourceId }, data: { contactId: survivorId } });

  // ── ContactSubscription — @@unique([contactId, topicId]) ────────────────
  const subDb = db as never as SubDb;
  const [survivorSubs, sourceSubs] = await Promise.all([
    subDb.contactSubscription.findMany({ where: { contactId: survivorId } as never, select: { topicId: true } as never }),
    subDb.contactSubscription.findMany({ where: { contactId: sourceId } as never, select: { id: true, topicId: true } as never }),
  ]);
  const survivorSubSet = new Set(survivorSubs.map((s) => s.topicId));
  const duplicateSubIds = sourceSubs.filter((s) => survivorSubSet.has(s.topicId)).map((s) => s.id);
  if (duplicateSubIds.length > 0) {
    await subDb.contactSubscription.deleteMany({ where: { id: { in: duplicateSubIds } } as never });
  }
  await subDb.contactSubscription.updateMany({ where: { contactId: sourceId } as never, data: { contactId: survivorId } as never });

  // ── CustomFieldValue — @@unique([contactId, fieldId]) ───────────────────
  const cfDb = db as never as {
    customFieldValue: {
      findMany: (a: unknown) => Promise<{ id: string; fieldId: string }[]>;
      deleteMany: (a: unknown) => Promise<unknown>;
      updateMany: (a: unknown) => Promise<unknown>;
    };
  };
  const [survivorCf, sourceCf] = await Promise.all([
    cfDb.customFieldValue.findMany({ where: { contactId: survivorId } as never, select: { fieldId: true } as never }),
    cfDb.customFieldValue.findMany({ where: { contactId: sourceId } as never, select: { id: true, fieldId: true } as never }),
  ]);
  const survivorCfSet = new Set(survivorCf.map((v) => v.fieldId));
  const duplicateCfIds = sourceCf.filter((v) => survivorCfSet.has(v.fieldId)).map((v) => v.id);
  if (duplicateCfIds.length > 0) {
    await cfDb.customFieldValue.deleteMany({ where: { id: { in: duplicateCfIds } } as never });
  }
  await cfDb.customFieldValue.updateMany({ where: { contactId: sourceId } as never, data: { contactId: survivorId } as never });

  // ── Non-constrained: ContactNote, ContactAddress, ContactActivity, ContactIdentity ──
  await Promise.all([
    db.contactNote.updateMany({ where: { contactId: sourceId }, data: { contactId: survivorId } }),
    db.contactAddress.updateMany({ where: { contactId: sourceId }, data: { contactId: survivorId } }),
    (db as never as { contactActivity: { updateMany: (a: unknown) => Promise<unknown> } })
      .contactActivity.updateMany({ where: { contactId: sourceId } as never, data: { contactId: survivorId } as never }),
    (db as never as IdDb).contactIdentity
      .updateMany({ where: { contactId: sourceId } as never, data: { contactId: survivorId } as never }),
  ]);

  // ── ContactAttribution — @unique(contactId): move only if survivor has none ──
  const attrDb = db as never as AttrDb;
  const survivorAttr = await attrDb.contactAttribution.findUnique({ where: { contactId: survivorId } as never });
  if (!survivorAttr) {
    await attrDb.contactAttribution.update({
      where: { contactId: sourceId } as never,
      data: { contactId: survivorId } as never,
    }).catch(() => {});
  }

  // ── Log merge history ────────────────────────────────────────────────────
  const mergeDb = db as never as MergeDb;
  await mergeDb.contactMergeHistory.create({
    data: {
      survivorId,
      absorbedId: source.id,
      absorbedEmail: source.email,
      mergedBy: session.user.id,
    } as never,
  });

  // ── Delete source contact (cascade handles remaining FKs) ───────────────
  await db.contact.delete({ where: { id: sourceId } });

  return res.status(200).json({ survivorId });
}
