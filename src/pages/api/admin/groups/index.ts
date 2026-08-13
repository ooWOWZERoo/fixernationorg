import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { GroupVisibility } from "@prisma/client";

function isAdmin(role: string) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

const createBody = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only."),
  description: z.string().max(500).optional(),
  coverUrl: z.string().url().optional().or(z.literal("")),
  autoMember: z.boolean().optional(),
  autoAmbassador: z.boolean().optional(),
  autoProvider: z.boolean().optional(),
  visibility: z.nativeEnum(GroupVisibility).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !isAdmin(session.user.role)) return res.status(403).json({ error: "Forbidden." });

  if (req.method === "GET") {
    const groups = await db.socialGroup.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { members: true, posts: true } },
        requests: { where: { status: "PENDING" }, select: { id: true } },
      },
    });
    return res.status(200).json({ groups });
  }

  if (req.method === "POST") {
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid data." });
    }

    const { name, slug, description, coverUrl, autoMember, autoAmbassador, autoProvider, visibility } = parsed.data;

    const slugTaken = await db.socialGroup.findUnique({ where: { slug } });
    if (slugTaken) return res.status(409).json({ error: "Slug already in use." });

    const group = await db.socialGroup.create({
      data: {
        name,
        slug,
        description: description ?? null,
        coverUrl: coverUrl || null,
        autoMember: autoMember ?? false,
        autoAmbassador: autoAmbassador ?? false,
        autoProvider: autoProvider ?? false,
        visibility: visibility ?? "PUBLIC",
      },
    });

    // Creator becomes the group owner
    await db.groupMember.create({
      data: { groupId: group.id, userId: session.user.id, role: "OWNER" },
    });

    return res.status(201).json({ group });
  }

  return res.status(405).end();
}
