import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const createSchema = z.object({
  title: z.string().min(2).max(200),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(5000).optional().nullable(),
  coverUrl: z.string().url().max(500).or(z.literal("")).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  isVirtual: z.boolean().optional(),
  meetingUrl: z.string().url().max(500).or(z.literal("")).optional().nullable(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional().nullable(),
  capacity: z.number().int().positive().optional().nullable(),
  priceCents: z.number().int().min(0).optional(),
  publishedAt: z.string().datetime().optional().nullable(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    const events = await db.event.findMany({
      orderBy: { startsAt: "asc" },
      include: { _count: { select: { rsvps: true } } },
    });
    return res.json(events);
  }

  if (req.method === "POST") {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });

    const { startsAt, endsAt, publishedAt, coverUrl, meetingUrl, ...rest } = parsed.data;
    const event = await db.event.create({
      data: {
        ...rest,
        coverUrl: coverUrl || null,
        meetingUrl: meetingUrl || null,
        startsAt: new Date(startsAt),
        endsAt: endsAt ? new Date(endsAt) : null,
        publishedAt: publishedAt ? new Date(publishedAt) : null,
      },
    });
    return res.status(201).json(event);
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
