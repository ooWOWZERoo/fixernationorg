import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const createSchema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  source: z.string().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !ADMIN_ROLES.includes(session.user.role)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    const { q, tag, page = "1" } = req.query;
    const take = 50;
    const skip = (parseInt(page as string) - 1) * take;

    const where: Record<string, unknown> = {};
    if (q) {
      where.OR = [
        { email: { contains: q as string, mode: "insensitive" } },
        { firstName: { contains: q as string, mode: "insensitive" } },
        { lastName: { contains: q as string, mode: "insensitive" } },
        { company: { contains: q as string, mode: "insensitive" } },
      ];
    }
    if (tag) {
      where.tags = { some: { tag: tag as string } };
    }

    const [contacts, total] = await Promise.all([
      db.contact.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          tags: { select: { tag: true } },
          consents: { select: { topic: true, optedIn: true } },
          _count: { select: { listMemberships: true, campaignSends: true } },
        },
      }),
      db.contact.count({ where }),
    ]);

    return res.status(200).json({ contacts, total, page: parseInt(page as string), pages: Math.ceil(total / take) });
  }

  if (req.method === "POST") {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const existing = await db.contact.findUnique({ where: { email: parsed.data.email } });
    if (existing) return res.status(409).json({ error: "A contact with this email already exists" });

    const contact = await db.contact.create({
      data: { ...parsed.data, source: parsed.data.source ?? "admin" },
    });
    return res.status(201).json(contact);
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
