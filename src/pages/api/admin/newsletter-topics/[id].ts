import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.query as { id: string };

  const topic = await db.newsletterTopic.findUnique({ where: { id } });
  if (!topic) return res.status(404).json({ error: "Not found" });

  if (req.method === "PUT") {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const updated = await db.newsletterTopic.update({
      where: { id },
      data: parsed.data,
    });
    return res.status(200).json(updated);
  }

  if (req.method === "DELETE") {
    const subCount = await db.contactSubscription.count({ where: { topicId: id } });
    if (subCount > 0) {
      return res.status(409).json({ error: `Cannot delete — ${subCount} contact(s) subscribed` });
    }
    await db.newsletterTopic.delete({ where: { id } });
    return res.status(204).end();
  }

  res.setHeader("Allow", "PUT, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
