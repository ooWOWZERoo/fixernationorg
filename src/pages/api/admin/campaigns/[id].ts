import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendCampaignNow, computeCampaignMetric } from "@/lib/send-campaign";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

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
  pushUrl: z.string().url().nullable().optional(),
  pushIcon: z.string().url().nullable().optional(),
  listId: z.string().nullable().optional(),
  audienceRules: audienceRulesSchema,
  scheduledAt: z.string().datetime().nullable().optional(),
  isAbTest: z.boolean().optional(),
  isAmbassadorMaterial: z.boolean().optional(),
  recurrenceActive: z.boolean().optional(),
  recurrenceTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !ADMIN_ROLES.includes(session.user.adminRole)) {
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
          htmlBody: updated.htmlBody ?? "",
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

    const result = await sendCampaignNow(id);

    switch (result.status) {
      case "already_sent":
        return res.status(409).json({ error: "Campaign already sent or sending" });
      case "no_audience":
        return res.status(400).json({ error: "Campaign has no audience defined" });
      case "no_recipients":
        return res.status(200).json({ message: "No eligible contacts to send to", sent: 0 });
      case "no_push_subscriptions":
        return res.status(200).json({ message: "No contacts with push subscriptions", sent: 0 });
      case "ab_test_misconfigured":
        return res.status(400).json({ error: result.error });
      case "not_found":
        return res.status(404).json({ error: "Campaign not found" });
      case "sending_in_progress":
        return res.status(200).json({
          message: result.pausedForHourlyCap
            ? `Paused — hourly send limit reached, will resume automatically next hour (${result.sent} sent so far${result.failed > 0 ? `, ${result.failed} failed` : ""})`
            : `Send in progress — ${result.sent} sent so far${result.failed > 0 ? ` (${result.failed} failed)` : ""}, continuing in the background`,
          sent: result.sent,
          failed: result.failed,
          pausedForHourlyCap: result.pausedForHourlyCap,
        });
      case "sent":
        return res.status(200).json({
          message: `Sent to ${result.sent} contacts${result.failed > 0 ? ` (${result.failed} failed)` : ""}`,
          sent: result.sent,
          failed: result.failed,
        });
    }
  }

  res.setHeader("Allow", "GET, PUT, POST, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
