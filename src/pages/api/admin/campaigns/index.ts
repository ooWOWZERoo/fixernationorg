import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { CampaignStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const audienceRulesSchema = z.object({
  logic: z.enum(["OR", "AND"]).default("OR"),
  include: z.array(z.record(z.unknown())),
  exclude: z.array(z.record(z.unknown())),
}).optional();

const createSchema = z.object({
  name: z.string().min(1).max(200),
  channelType: z.enum(["EMAIL", "PUSH"]).optional(),
  subject: z.string().min(1).max(200),
  fromName: z.string().optional(),
  fromEmail: z.string().email().optional(),
  htmlBody: z.string().min(1).optional(),
  textBody: z.string().optional(),
  pushUrl: z.string().url().optional(),
  pushIcon: z.string().url().optional(),
  templateId: z.string().optional(),
  listId: z.string().optional(),
  audienceRules: audienceRulesSchema,
  scheduledAt: z.string().datetime().optional(),
  isRecurring: z.boolean().optional(),
  recurrenceFrequency: z.enum(["DAILY", "WEEKLY"]).optional(),
  recurrenceTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  recurrenceSource: z.enum(["MORNING_BOOST"]).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    const { status } = req.query;
    const campaigns = await db.campaign.findMany({
      where: status ? { status: status as CampaignStatus } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        list: { select: { id: true, name: true } },
        _count: { select: { sends: true } },
      },
    });
    return res.status(200).json(campaigns);
  }

  if (req.method === "POST") {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const channelType = parsed.data.channelType ?? "EMAIL";
    if (channelType === "EMAIL" && !parsed.data.htmlBody) {
      return res.status(400).json({ error: "htmlBody is required for email campaigns" });
    }
    if (parsed.data.isRecurring && channelType === "PUSH") {
      return res.status(400).json({ error: "Recurring campaigns support the email channel only" });
    }

    // Validate that the list (if provided) is FN_ADMIN-owned — AC-067
    if (parsed.data.listId) {
      const list = await db.contactList.findUnique({ where: { id: parsed.data.listId } });
      if (!list) return res.status(400).json({ error: "List not found" });
      if (list.ownerType !== "FN_ADMIN") {
        return res.status(403).json({ error: "FN campaigns cannot use ambassador or provider lists" });
      }
    }

    const { audienceRules: rawAudienceRules, channelType: _ch, recurrenceTime: _rt, ...restData } = parsed.data;
    const campaign = await (db.campaign as unknown as {
      create: (a: unknown) => Promise<{ id: string; subject: string; htmlBody: string | null; textBody: string | null; fromName: string; fromEmail: string }>;
    }).create({
      data: {
        ...restData,
        channelType,
        audienceRules: rawAudienceRules !== undefined ? (rawAudienceRules as never) : undefined,
        scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
        status: parsed.data.scheduledAt ? "SCHEDULED" : "DRAFT",
        createdBy: session.user.id,
        // Vercel Hobby caps cron jobs at once-per-day, so every recurring
        // campaign fires on the same fixed daily schedule (7am UTC) rather
        // than an admin-chosen time — see runCampaignRecurringDispatch in
        // cron.ts. Stored for a possible future per-template-time upgrade,
        // not actually used to gate firing today.
        recurrenceTime: parsed.data.isRecurring ? "07:00" : undefined,
      },
    });

    // Save initial version snapshot (email campaigns only)
    if (channelType === "EMAIL") {
      await db.campaignVersion.create({
        data: {
          campaignId: campaign.id,
          version: 1,
          subject: campaign.subject,
          htmlBody: campaign.htmlBody ?? "",
          textBody: campaign.textBody,
          fromName: campaign.fromName,
          fromEmail: campaign.fromEmail,
          savedBy: session.user.id,
        },
      });
    }

    return res.status(201).json(campaign);
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
