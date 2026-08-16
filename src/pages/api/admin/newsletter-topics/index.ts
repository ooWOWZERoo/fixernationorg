import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    const topics = await db.newsletterTopic.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { subscriptions: true } } },
    });
    return res.status(200).json(topics);
  }

  if (req.method === "POST") {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const slug = parsed.data.slug ?? toSlug(parsed.data.name);

    const existing = await db.newsletterTopic.findUnique({ where: { slug } });
    if (existing) return res.status(409).json({ error: "A topic with that slug already exists" });

    const topic = await db.newsletterTopic.create({
      data: { name: parsed.data.name, slug, description: parsed.data.description },
    });
    return res.status(201).json(topic);
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
