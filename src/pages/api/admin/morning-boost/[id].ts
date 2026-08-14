import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  excerpt: z.string().optional().nullable(),
  body: z.string().min(1).optional(),
  imageUrl: z.string().url().optional().or(z.literal("")).nullable(),
  authorName: z.string().optional(),
  publishedAt: z.string().nullable().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id } = req.query as { id: string };

  if (req.method === "GET") {
    const entry = await db.morningBoost.findUnique({ where: { id } });
    if (!entry) return res.status(404).json({ error: "Not found" });
    return res.status(200).json(entry);
  }

  if (req.method === "PUT") {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const { imageUrl, publishedAt, ...rest } = parsed.data;
    const data: Record<string, unknown> = { ...rest };
    if (imageUrl !== undefined) data.imageUrl = imageUrl || null;
    if (publishedAt !== undefined) data.publishedAt = publishedAt ? new Date(publishedAt) : null;

    try {
      const entry = await db.morningBoost.update({ where: { id }, data });
      return res.status(200).json(entry);
    } catch (err: unknown) {
      if (
        err != null &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "P2025"
      ) {
        return res.status(404).json({ error: "Not found" });
      }
      if (
        err != null &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        return res.status(409).json({ error: "An entry with that slug already exists." });
      }
      throw err;
    }
  }

  if (req.method === "DELETE") {
    try {
      await db.morningBoost.delete({ where: { id } });
      return res.status(204).end();
    } catch {
      return res.status(404).json({ error: "Not found" });
    }
  }

  res.setHeader("Allow", "GET, PUT, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
