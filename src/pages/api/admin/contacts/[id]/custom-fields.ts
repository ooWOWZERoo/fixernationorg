import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const upsertSchema = z.object({
  values: z.array(z.object({
    fieldId: z.string().min(1),
    value:   z.string(),
  })),
});

type CfvDb = {
  customFieldValue: {
    findMany: (a: unknown) => Promise<unknown[]>;
    upsert:   (a: unknown) => Promise<unknown>;
    deleteMany: (a: unknown) => Promise<unknown>;
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id: contactId } = req.query as { id: string };

  const contact = await db.contact.findUnique({ where: { id: contactId }, select: { id: true } });
  if (!contact) return res.status(404).json({ error: "Contact not found" });

  const cfvDb = db as never as CfvDb;

  if (req.method === "GET") {
    const values = await cfvDb.customFieldValue.findMany({
      where: { contactId } as never,
      include: { field: { select: { id: true, slug: true, label: true, type: true } } } as never,
      orderBy: { field: { sortOrder: "asc" } } as never,
    });
    return res.status(200).json(values);
  }

  if (req.method === "PUT") {
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const results = await Promise.all(
      parsed.data.values.map(({ fieldId, value }) => {
        if (!value.trim()) {
          // Empty value = delete the entry
          return cfvDb.customFieldValue.deleteMany({
            where: { contactId, fieldId } as never,
          }).then(() => null);
        }
        return cfvDb.customFieldValue.upsert({
          where: { contactId_fieldId: { contactId, fieldId } } as never,
          create: { contactId, fieldId, value } as never,
          update: { value, updatedAt: new Date() } as never,
        });
      })
    );
    return res.status(200).json(results.filter(Boolean));
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ error: "Method not allowed" });
}
