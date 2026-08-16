import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const createSchema = z.object({
  name: z.string().min(1).max(200),
  blocks: z.array(z.record(z.unknown())),
  tags: z.string().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !ADMIN_ROLES.includes(session.user.role)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    const sections = await db.savedSection.findMany({
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).json(sections);
  }

  if (req.method === "POST") {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const section = await db.savedSection.create({
      data: {
        name: parsed.data.name,
        blocks: parsed.data.blocks as never,
        tags: parsed.data.tags ?? null,
        createdBy: session.user.id,
      },
    });
    return res.status(201).json(section);
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
