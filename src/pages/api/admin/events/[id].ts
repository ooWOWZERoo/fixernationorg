import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const updateSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(5000).optional(),
  coverUrl: z.string().url().max(500).or(z.literal("")).optional(),
  location: z.string().max(200).optional(),
  isVirtual: z.boolean().optional(),
  meetingUrl: z.string().url().max(500).or(z.literal("")).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional().nullable(),
  capacity: z.number().int().positive().optional().nullable(),
  priceCents: z.number().int().min(0).optional(),
  publishedAt: z.string().datetime().optional().nullable(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id } = req.query as { id: string };

  if (req.method === "GET") {
    const event = await db.event.findUnique({
      where: { id },
      include: {
        rsvps: {
          where: { status: "REGISTERED" },
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: "asc" },
        },
        _count: { select: { rsvps: true } },
      },
    });
    if (!event) return res.status(404).json({ error: "Not found" });
    return res.json(event);
  }

  if (req.method === "PUT") {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });

    const { startsAt, endsAt, publishedAt, coverUrl, meetingUrl, ...rest } = parsed.data;
    const event = await db.event.update({
      where: { id },
      data: {
        ...rest,
        ...(coverUrl !== undefined ? { coverUrl: coverUrl || null } : {}),
        ...(meetingUrl !== undefined ? { meetingUrl: meetingUrl || null } : {}),
        ...(startsAt ? { startsAt: new Date(startsAt) } : {}),
        ...(endsAt !== undefined ? { endsAt: endsAt ? new Date(endsAt) : null } : {}),
        ...(publishedAt !== undefined ? { publishedAt: publishedAt ? new Date(publishedAt) : null } : {}),
      },
    });
    return res.json(event);
  }

  if (req.method === "DELETE") {
    await db.event.delete({ where: { id } });
    return res.status(204).end();
  }

  res.setHeader("Allow", "GET, PUT, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
