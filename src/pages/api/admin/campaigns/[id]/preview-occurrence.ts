import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildMorningBoostEmail } from "@/lib/emails/morning-boost";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

// Dry-run: resolves what the NEXT occurrence of a recurring template would
// actually send, without creating a RecurrenceRun, a child Campaign, or
// sending anything — lets an admin sanity-check content before the first
// real send.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.query as { id: string };
  const template = await db.campaign.findUnique({ where: { id } });
  if (!template) return res.status(404).json({ error: "Campaign not found" });
  if (!template.isRecurring || template.parentCampaignId) {
    return res.status(400).json({ error: "Not a recurring template" });
  }

  if (template.recurrenceSource === "MORNING_BOOST") {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const entry = await db.morningBoost.findFirst({
      where: { publishedAt: { gte: startOfDay, lt: endOfDay } },
      select: { id: true, title: true, body: true, authorName: true, publishedAt: true, slug: true, excerpt: true, imageUrl: true },
    });

    if (!entry || !entry.publishedAt) {
      return res.status(200).json({ willSend: false, reason: "No Morning Boost entry published today" });
    }
    if (entry.id === template.lastMorningBoostId) {
      return res.status(200).json({ willSend: false, reason: "Today's entry was already used for the last occurrence" });
    }

    const { subject, html, text } = buildMorningBoostEmail(
      { ...entry, publishedAt: new Date(entry.publishedAt) },
      null
    );
    return res.status(200).json({ willSend: true, subject, html, text });
  }

  return res.status(200).json({
    willSend: true,
    subject: template.subject,
    html: template.htmlBody,
    text: template.textBody,
  });
}
