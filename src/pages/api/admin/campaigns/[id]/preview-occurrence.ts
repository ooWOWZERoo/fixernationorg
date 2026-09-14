import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildMorningBoostEmail } from "@/lib/emails/morning-boost";
import { utcDayWindow } from "@/lib/send-campaign";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

// Dry-run: resolves what the NEXT occurrence(s) of a recurring template
// would actually send, without creating a RecurrenceRun, a child Campaign,
// or sending anything — lets an admin sanity-check content before the first
// real send.
//
// For a MORNING_BOOST template, "the next send" isn't a single fixed thing —
// it's whichever MorningBoost entry has the earliest publishedAt >= today
// that hasn't fired yet, and there can be many of those queued up. `offset`
// (0-based) pages through that real, finite queue in publishedAt order so
// an admin can scroll all the way to the end of what's actually scheduled,
// instead of only ever seeing today's slot (which is empty most days).
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id, offset: offsetRaw } = req.query as { id: string; offset?: string };
  const offset = Math.max(0, Number.parseInt(offsetRaw ?? "0", 10) || 0);

  const template = await db.campaign.findUnique({ where: { id } });
  if (!template) return res.status(404).json({ error: "Campaign not found" });
  if (!template.isRecurring || template.parentCampaignId) {
    return res.status(400).json({ error: "Not a recurring template" });
  }

  if (template.recurrenceSource === "MORNING_BOOST") {
    const { startOfDay } = utcDayWindow(new Date());

    // Fetch two at a time starting at `offset` so we can tell the caller
    // whether this is the last queued entry without a separate count query.
    const [entry, next] = await db.morningBoost.findMany({
      where: { publishedAt: { gte: startOfDay } },
      orderBy: { publishedAt: "asc" },
      skip: offset,
      take: 2,
      select: { id: true, title: true, body: true, authorName: true, publishedAt: true, slug: true, excerpt: true, imageUrl: true, videoUrl: true },
    });

    if (!entry || !entry.publishedAt) {
      return res.status(200).json({
        willSend: false,
        reason: offset === 0 ? "No Morning Boost entries queued from today onward" : "No more queued Morning Boost entries",
        offset,
        isLast: true,
      });
    }
    // Only today's slot (offset 0) is subject to the dispatcher's same-day
    // duplicate guard — a future queued entry hasn't been touched yet.
    if (offset === 0 && entry.id === template.lastMorningBoostId) {
      return res.status(200).json({ willSend: false, reason: "Today's entry was already used for the last occurrence", offset, isLast: !next });
    }

    const { subject, html, text } = buildMorningBoostEmail(
      { ...entry, publishedAt: new Date(entry.publishedAt) },
      null
    );
    return res.status(200).json({
      willSend: true,
      subject,
      html,
      text,
      boostDate: entry.publishedAt,
      offset,
      isLast: !next,
    });
  }

  return res.status(200).json({
    willSend: true,
    subject: template.subject,
    html: template.htmlBody,
    text: template.textBody,
    offset: 0,
    isLast: true,
  });
}
