import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

type IdDb = {
  contactIdentity: {
    findMany: (a: unknown) => Promise<{
      id: string; type: string; value: string; label: string | null; isPrimary: boolean; createdAt: Date;
    }[]>;
    create: (a: unknown) => Promise<{
      id: string; type: string; value: string; label: string | null; isPrimary: boolean; createdAt: Date;
    }>;
  };
};

const createSchema = z.object({
  type: z.enum(["EMAIL", "PHONE", "EXTERNAL_ID"]),
  value: z.string().min(1).max(500),
  label: z.string().max(100).optional(),
  isPrimary: z.boolean().default(false),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !ADMIN_ROLES.includes(session.user.role)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.query as { id: string };
  const contact = await db.contact.findUnique({ where: { id }, select: { id: true } });
  if (!contact) return res.status(404).json({ error: "Contact not found" });

  const idDb = db as never as IdDb;

  if (req.method === "GET") {
    const identities = await idDb.contactIdentity.findMany({
      where: { contactId: id } as never,
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] as never,
    });
    return res.status(200).json(identities.map((i) => ({
      ...i,
      createdAt: i.createdAt.toISOString(),
    })));
  }

  if (req.method === "POST") {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const identity = await idDb.contactIdentity.create({
      data: {
        contactId: id,
        type: parsed.data.type,
        value: parsed.data.value.trim(),
        label: parsed.data.label?.trim() ?? null,
        isPrimary: parsed.data.isPrimary,
      } as never,
    });

    return res.status(201).json({ ...identity, createdAt: identity.createdAt.toISOString() });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
