import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const createSchema = z.object({
  name: z.string().min(1).max(200),
  subject: z.string().min(1).max(200),
  htmlBody: z.string().min(1),
  textBody: z.string().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !ADMIN_ROLES.includes(session.user.role)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    const templates = await db.emailTemplate.findMany({
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { campaigns: true } } },
    });
    return res.status(200).json(templates);
  }

  if (req.method === "POST") {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const template = await db.emailTemplate.create({
      data: { ...parsed.data, createdBy: session.user.id },
    });
    return res.status(201).json(template);
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
