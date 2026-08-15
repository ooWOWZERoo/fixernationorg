import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { buildCampaignEmail } from "@/lib/campaign-email";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  subject: z.string().min(1).max(200).optional(),
  fromName: z.string().optional(),
  fromEmail: z.string().email().optional(),
  htmlBody: z.string().optional(),
  textBody: z.string().optional(),
  listId: z.string().nullable().optional(),
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

    const updated = await db.campaign.update({
      where: { id },
      data: {
        ...parsed.data,
        scheduledAt: parsed.data.scheduledAt !== undefined
          ? parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null
          : undefined,
        status: parsed.data.scheduledAt ? "SCHEDULED" : campaign.status === "SCHEDULED" ? "DRAFT" : campaign.status,
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

  // POST action: send
  if (req.method === "POST") {
    const { action } = req.body ?? {};
    if (action !== "send") return res.status(400).json({ error: "Unknown action" });

    if (campaign.status === "SENDING" || campaign.status === "SENT") {
      return res.status(409).json({ error: "Campaign already sent or sending" });
    }
    if (!campaign.listId) {
      return res.status(400).json({ error: "Campaign has no list assigned" });
    }

    // Resolve contacts from the list
    const members = await db.contactListMember.findMany({
      where: { listId: campaign.listId },
      include: {
        contact: {
          select: { id: true, email: true, firstName: true },
          include: { consents: { where: { topic: "CAMPAIGNS" } } } as never,
        },
      },
    });

    // Only send to contacts who have consented to campaigns (or have no explicit consent row yet)
    const eligible = members.filter((m) => {
      const c = m.contact as unknown as { consents: Array<{ optedIn: boolean }> };
      const consent = c.consents?.[0];
      return !consent || consent.optedIn;
    });

    if (eligible.length === 0) {
      return res.status(200).json({ message: "No eligible contacts to send to", sent: 0 });
    }

    // Mark campaign as SENDING
    await db.campaign.update({ where: { id }, data: { status: "SENDING" } });

    // Queue CampaignSend rows
    await db.campaignSend.createMany({
      data: eligible.map((m) => ({ campaignId: id, contactId: m.contactId })),
      skipDuplicates: true,
    });

    // Send in batches of 20
    const BATCH = 20;
    let sent = 0;
    let failed = 0;
    const now = new Date();

    for (let i = 0; i < eligible.length; i += BATCH) {
      const batch = eligible.slice(i, i + BATCH);
      await Promise.allSettled(
        batch.map(async (m) => {
          try {
            const { subject, html, text } = buildCampaignEmail(
              campaign,
              m.contactId,
              m.contact.firstName
            );
            await sendEmail({ to: m.contact.email, subject, html, text });
            await db.campaignSend.update({
              where: { campaignId_contactId: { campaignId: id, contactId: m.contactId } },
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

    return res.status(200).json({ message: `Sent to ${sent} contacts${failed > 0 ? ` (${failed} failed)` : ""}`, sent, failed });
  }

  res.setHeader("Allow", "GET, PUT, POST, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
