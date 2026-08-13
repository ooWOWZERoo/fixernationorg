import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { GroupType, GroupVisibility } from "@prisma/client";

function isAdmin(role: string) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

const updateBody = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  description: z.string().max(500).optional().nullable(),
  coverUrl: z.string().url().optional().nullable().or(z.literal("")),
  type: z.nativeEnum(GroupType).optional(),
  visibility: z.nativeEnum(GroupVisibility).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !isAdmin(session.user.role)) return res.status(403).json({ error: "Forbidden." });

  const id = req.query.id as string;
  const group = await db.socialGroup.findUnique({ where: { id } });
  if (!group) return res.status(404).json({ error: "Group not found." });

  if (req.method === "PUT") {
    const parsed = updateBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid data." });
    }

    const { slug, ...rest } = parsed.data;

    if (slug && slug !== group.slug) {
      const taken = await db.socialGroup.findUnique({ where: { slug } });
      if (taken) return res.status(409).json({ error: "Slug already in use." });
    }

    const updated = await db.socialGroup.update({
      where: { id },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(slug ? { slug } : {}),
        ...(Object.prototype.hasOwnProperty.call(rest, "description")
          ? { description: rest.description ?? null }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(rest, "coverUrl")
          ? { coverUrl: rest.coverUrl || null }
          : {}),
        ...(rest.type ? { type: rest.type } : {}),
        ...(rest.visibility ? { visibility: rest.visibility } : {}),
      },
    });

    return res.status(200).json({ group: updated });
  }

  if (req.method === "DELETE") {
    await db.socialGroup.delete({ where: { id } });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
