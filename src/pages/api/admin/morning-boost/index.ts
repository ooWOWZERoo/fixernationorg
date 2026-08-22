import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sanitizeMorningBoostBody } from "@/lib/sanitize-html";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const toSlug = (title: string) =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const createSchema = z.object({
  title: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  excerpt: z.string().optional(),
  body: z.string().min(1),
  imageUrl: z.string().url().optional().or(z.literal("")),
  videoUrl: z.string().url().optional().or(z.literal("")),
  authorName: z.string().default("Anthony J. Placito"),
  publishedAt: z.string().nullable().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    const entries = await db.morningBoost.findMany({
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: { id: true, slug: true, title: true, publishedAt: true, createdAt: true },
    });
    return res.status(200).json(entries);
  }

  if (req.method === "POST") {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const { title, slug, imageUrl, videoUrl, body, publishedAt, ...rest } = parsed.data;
    const resolvedSlug = slug ?? toSlug(title);

    try {
      const entry = await db.morningBoost.create({
        data: {
          title,
          slug: resolvedSlug,
          imageUrl: imageUrl || null,
          videoUrl: videoUrl || null,
          body: sanitizeMorningBoostBody(body),
          publishedAt: publishedAt ? new Date(publishedAt) : null,
          ...rest,
        },
      });
      return res.status(201).json(entry);
    } catch (err: unknown) {
      if (
        err != null &&
        typeof err === "object" &&
        "code" in err
      ) {
        const code = (err as { code: string }).code;
        if (code === "P2002") {
          return res.status(409).json({ error: "An entry with that slug already exists." });
        }
        // Return a user-friendly error for other Prisma errors instead of crashing
        console.error(`Prisma error creating morning boost (${code}):`, err);
        return res.status(500).json({ error: "Database error - please try again." });
      }
      console.error("Error creating morning boost:", err);
      return res.status(500).json({ error: "An error occurred while creating the entry. Please try again." });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
