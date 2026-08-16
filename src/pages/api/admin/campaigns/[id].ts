import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { buildCampaignEmail } from "@/lib/campaign-email";
import { resolveAudience, type AudienceDefinition } from "@/lib/audience";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

async function computeCampaignMetric(campaignId: string) {
  const rows = await db.campaignSend.groupBy({
    by: ["status"],
    where: { campaignId },
    _count: { status: true },
  });
  const s: Record<string, number> = {};
  for (const r of rows) s[r.status] = r._count.status;

  const totalSent = (s.SENT ?? 0) + (s.OPENED ?? 0) + (s.CLICKED ?? 0) + (s.BOUNCED ?? 0);
  const totalDelivered = (s.SENT ?? 0) + (s.OPENED ?? 0) + (s.CLICKED ?? 0);
  const totalOpened = (s.OPENED ?? 0) + (s.CLICKED ?? 0);
  const totalClicked = s.CLICKED ?? 0;
  const totalBounced = s.BOUNCED ?? 0;
  const totalUnsubscribed = s.UNSUBSCRIBED ?? 0;

  const openRate = totalDelivered > 0 ? totalOpened / totalDelivered : 0;
  const clickRate = totalDelivered > 0 ? totalClicked / totalDelivered : 0;
  const bounceRate = totalSent > 0 ? totalBounced / totalSent : 0;
  const unsubRate = totalDelivered > 0 ? totalUnsubscribed / totalDelivered : 0;

  return db.campaignMetric.upsert({
    where: { campaignId },
    create: {
      campaignId,
      totalSent, totalDelivered, totalOpened, totalClicked, totalBounced, totalUnsubscribed,
      openRate, clickRate, bounceRate, unsubRate,
    },
    update: {
      totalSent, totalDelivered, totalOpened, totalClicked, totalBounced, totalUnsubscribed,
      openRate, clickRate, bounceRate, unsubRate,
      computedAt: new Date(),
    },
  });
}

const audienceRulesSchema = z.object({
  logic: z.enum(["OR", "AND"]).default("OR"),
  include: z.array(z.record(z.unknown())),
  exclude: z.array(z.record(z.unknown())),
}).nullable().optional();

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  subject: z.string().min(1).max(200).optional(),
  fromName: z.string().optional(),
  fromEmail: z.string().email().optional(),
  htmlBody: z.string().optional(),
  textBody: z.string().optional(),
  listId: z.string().nullable().optional(),
  audienceRules: audienceRulesSchema,
  scheduledAt: z.string().datetime().nullable().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !ADMIN_ROLES.includes(session.user.role)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.query as { id: string };

  const campaign = await db.campaign.findUnique({
    where: { id },
    include: {
      list: { select: { id: true, name: true } },
      _count: { select: { sends: true } },
    },
  });
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });

  if (req.method === "GET") {
    const stats = await db.campaignSend.groupBy({
      by: ["status"],
      where: { campaignId: id },
      _count: { status: true },
    });
    return res.status(200).json({ ...campaign, stats });
  }

  if (req.method === "PUT") {
    if (campaign.status === "SENDING" || campaign.status === "SENT") {
      return res.status(409).json({ error: "Cannot edit a campaign that is sending or sent" });
    }
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    if (parsed.data.listId) {
      const list = await db.contactList.findUnique({ where: { id: parsed.data.listId } });
      if (!list) return res.status(400).json({ error: "List not found" });
      if (list.ownerType !== "FN_ADMIN") {
        return res.status(403).json({ error: "FN campaigns cannot use ambassador or provider lists" });
      }
    }

    const { audienceRules: rawAudienceRules, scheduledAt: rawScheduledAt, ...restData } = parsed.data;
    const updated = await db.campaign.update({
      where: { id },
      data: {
        ...restData,
        audienceRules: rawAudienceRules !== undefined
          ? (rawAudienceRules as never)
          : undefined,
        scheduledAt: rawScheduledAt !== undefined
          ? rawScheduledAt ? new Date(rawScheduledAt) : null
          : undefined,
        status: rawScheduledAt ? "SCHEDULED" : campaign.status === "SCHEDULED" ? "DRAFT" : campaign.status,
      },
    });

    // Save a new version snapshot on every content-bearing PUT
    const contentFields = ["subject", "htmlBody", "textBody", "fromName", "fromEmail"];
    const hasContentChange = contentFields.some((f) => (parsed.data as Record<string, unknown>)[f] !== undefined);
    if (hasContentChange) {
      const last = await db.campaignVersion.findFirst({
        where: { campaignId: id },
        orderBy: { version: "desc" },
      });
      await db.campaignVersion.create({
        data: {
          campaignId: id,
          version: (last?.version ?? 0) + 1,
          subject: updated.subject,
          htmlBody: updated.htmlBody,
          textBody: updated.textBody,
          fromName: updated.fromName,
          fromEmail: updated.fromEmail,
          savedBy: session.user.id,
        },
      });
    }

    return res.status(200).json(updated);
  }

  if (req.method === "DELETE") {
    if (campaign.status === "SENDING") {
      return res.status(409).json({ error: "Cannot delete a campaign while it is sending" });
    }
    await db.campaign.delete({ where: { id } });
    return res.status(204).end();
  }

  // POST action: send | compute_metrics
  if (req.method === "POST") {
    const { action } = req.body ?? {};
    if (!["send", "compute_metrics"].includes(action)) return res.status(400).json({ error: "Unknown action" });

    if (action === "compute_metrics") {
      const metric = await computeCampaignMetric(id);
      return res.status(200).json(metric);
    }

    if (campaign.status === "SENDING" || campaign.status === "SENT") {
      return res.status(409).json({ error: "Campaign already sent or sending" });
    }
    if (!campaign.listId && !campaign.audienceRules) {
      return res.status(400).json({ error: "Campaign has no audience defined" });
    }

    // ── Resolve recipients ────────────────────────────────────────────────────
    let eligibleContacts: Array<{ id: string; email: string; firstName: string | null }>;
    let suppressedCount = 0;

    if (campaign.audienceRules) {
      const def = campaign.audienceRules as unknown as AudienceDefinition;
      const { includedIds, suppressed } = await resolveAudience(def);
      suppressedCount = suppressed.length;
      eligibleContacts = includedIds.length > 0
        ? await db.contact.findMany({
            where: { id: { in: includedIds } },
            select: { id: true, email: true, firstName: true },
          })
        : [];

      // Save audience snapshot
      await (db.campaignAudienceSnapshot as never as {
        upsert: (args: unknown) => Promise<unknown>;
      }).upsert({
        where: { campaignId: id },
        create: {
          campaignId: id,
          totalIncluded: eligibleContacts.length,
          totalSuppressed: suppressedCount,
          rules: campaign.audienceRules,
        },
        update: {
          totalIncluded: eligibleContacts.length,
          totalSuppressed: suppressedCount,
          takenAt: new Date(),
          rules: campaign.audienceRules,
        },
      });
    } else {
      // Legacy path: use listId
      const members = await db.contactListMember.findMany({
        where: { listId: campaign.listId! },
        include: {
          contact: {
            select: { id: true, email: true, firstName: true },
            include: { consents: { where: { topic: "CAMPAIGNS" } } } as never,
          },
        },
      });
      eligibleContacts = members
        .filter((m) => {
          const c = m.contact as unknown as { consents: Array<{ optedIn: boolean }> };
          const consent = c.consents?.[0];
          return !consent || consent.optedIn;
        })
        .map((m) => ({
          id: m.contactId,
          email: (m.contact as { email: string }).email,
          firstName: (m.contact as { firstName: string | null }).firstName,
        }));

      // Snapshot for legacy path too
      await (db.campaignAudienceSnapshot as never as {
        upsert: (args: unknown) => Promise<unknown>;
      }).upsert({
        where: { campaignId: id },
        create: {
          campaignId: id,
          totalIncluded: eligibleContacts.length,
          totalSuppressed: 0,
          rules: { logic: "OR", include: [{ type: "list", listId: campaign.listId }], exclude: [] },
        },
        update: {
          totalIncluded: eligibleContacts.length,
          totalSuppressed: 0,
          takenAt: new Date(),
          rules: { logic: "OR", include: [{ type: "list", listId: campaign.listId }], exclude: [] },
        },
      });
    }

    if (eligibleContacts.length === 0) {
      return res.status(200).json({ message: "No eligible contacts to send to", sent: 0 });
    }

    // Mark campaign as SENDING
    await db.campaign.update({ where: { id }, data: { status: "SENDING" } });

    // Queue CampaignSend rows and fetch their IDs for tracking
    await db.campaignSend.createMany({
      data: eligibleContacts.map((c) => ({ campaignId: id, contactId: c.id })),
      skipDuplicates: true,
    });
    const sendRows = await db.campaignSend.findMany({
      where: { campaignId: id, status: "QUEUED" },
      select: { id: true, contactId: true },
    });
    const sendIdByContact = Object.fromEntries(sendRows.map((r) => [r.contactId, r.id]));

    // Send in batches of 20
    const BATCH = 20;
    let sent = 0;
    let failed = 0;
    const now = new Date();

    for (let i = 0; i < eligibleContacts.length; i += BATCH) {
      const batch = eligibleContacts.slice(i, i + BATCH);
      await Promise.allSettled(
        batch.map(async (c) => {
          try {
            const sendId = sendIdByContact[c.id];
            const { subject, html, text } = buildCampaignEmail(
              campaign,
              c.id,
              c.firstName,
              sendId
            );
            await sendEmail({ to: c.email, subject, html, text });
            await db.campaignSend.update({
              where: { campaignId_contactId: { campaignId: id, contactId: c.id } },
              data: { status: "SENT", sentAt: now },
            });
            sent++;
          } catch {
            failed++;
          }
        })
      );
    }

    await db.campaign.update({
      where: { id },
      data: { status: "SENT", sentAt: now },
    });

    computeCampaignMetric(id).catch(() => {});

    return res.status(200).json({ message: `Sent to ${sent} contacts${failed > 0 ? ` (${failed} failed)` : ""}`, sent, failed });
  }

  res.setHeader("Allow", "GET, PUT, POST, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
