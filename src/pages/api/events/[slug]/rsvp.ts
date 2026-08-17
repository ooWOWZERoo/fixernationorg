import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { awardPoints, POINTS } from "@/lib/loyalty";
import { enrollInJourneys } from "@/lib/automation";
import type { AutomationTrigger } from "@prisma/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Sign in to RSVP" });

  const { slug } = req.query as { slug: string };

  const event = await db.event.findUnique({
    where: { slug },
    include: { _count: { select: { rsvps: { where: { status: "REGISTERED" } } } } },
  });
  if (!event || !event.publishedAt) return res.status(404).json({ error: "Event not found" });

  const existing = await db.eventRsvp.findUnique({
    where: { eventId_userId: { eventId: event.id, userId: session.user.id } },
  });

  if (existing) {
    if (existing.status === "REGISTERED" || existing.status === "WAITLISTED") {
      await db.eventRsvp.update({
        where: { id: existing.id },
        data: { status: "CANCELLED" },
      });
      return res.json({ status: "CANCELLED" });
    }
    // Re-register
    const registeredCount = event._count.rsvps;
    const atCapacity = event.capacity !== null && registeredCount >= event.capacity;
    const newStatus = atCapacity ? "WAITLISTED" : "REGISTERED";
    await db.eventRsvp.update({ where: { id: existing.id }, data: { status: newStatus } });
    if (newStatus === "REGISTERED") {
      awardPoints(session.user.id, POINTS.EVENT_RSVP, "event_rsvp", event.id);
      enrollInJourneys({
        trigger: "EVENT_RSVP" as AutomationTrigger,
        userId: session.user.id,
        triggerConfig: { eventId: event.id },
        metadata: { eventId: event.id },
      }).catch(() => {});
    }
    return res.json({ status: newStatus });
  }

  const registeredCount = event._count.rsvps;
  const atCapacity = event.capacity !== null && registeredCount >= event.capacity;
  const status = atCapacity ? "WAITLISTED" : "REGISTERED";

  await db.eventRsvp.create({
    data: { eventId: event.id, userId: session.user.id, status },
  });

  if (status === "REGISTERED") {
    awardPoints(session.user.id, POINTS.EVENT_RSVP, "event_rsvp", event.id);
    enrollInJourneys({
      trigger: "EVENT_RSVP" as AutomationTrigger,
      userId: session.user.id,
      triggerConfig: { eventId: event.id },
      metadata: { eventId: event.id },
    }).catch(() => {});
  }

  return res.status(201).json({ status });
}
