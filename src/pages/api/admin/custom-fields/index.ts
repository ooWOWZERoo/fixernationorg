import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const FIELD_TYPES = ["TEXT", "NUMBER", "DATE", "DROPDOWN", "CHECKBOX", "URL", "TEXTAREA"] as const;

const createSchema = z.object({
  label:     z.string().min(1).max(100),
  slug:      z.string().min(1).max(80).regex(/^[a-z0-9_]+$/).optional(),
  type:      z.enum(FIELD_TYPES),
  options:   z.array(z.string().min(1)).optional().nullable(),
  required:  z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

function toSlug(label: string): string {
  return label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 80);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !ADMIN_ROLES.includes(session.user.role)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    const { activeOnly } = req.query;
    const where = activeOnly === "1" ? { active: true } : {};
    const fields = await (db as never as { customFieldDefinition: { findMany: (a: unknown) => Promise<unknown[]> } })
      .customFieldDefinition.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: { _count: { select: { values: true } } },
      });
    return res.status(200).json(fields);
  }

  if (req.method === "POST") {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { label, slug: rawSlug, type, options, required, sortOrder } = parsed.data;
    const slug = rawSlug ?? toSlug(label);

    const field = await (db as never as {
      customFieldDefinition: { create: (a: unknown) => Promise<unknown> }
    }).customFieldDefinition.create({
      data: {
        label,
        slug,
        type,
        options: (options?.length ?? 0) > 0 ? (options as never) : null,
        required: required ?? false,
        sortOrder: sortOrder ?? 0,
      },
    });
    return res.status(201).json(field);
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
