import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const FIELD_TYPES = ["TEXT", "NUMBER", "DATE", "DROPDOWN", "CHECKBOX", "URL", "TEXTAREA"] as const;

const updateSchema = z.object({
  label:     z.string().min(1).max(100).optional(),
  type:      z.enum(FIELD_TYPES).optional(),
  options:   z.array(z.string().min(1)).optional().nullable(),
  required:  z.boolean().optional(),
  active:    z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

type CfDb = {
  customFieldDefinition: {
    findUnique: (a: unknown) => Promise<unknown>;
    update: (a: unknown) => Promise<unknown>;
    delete: (a: unknown) => Promise<unknown>;
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !ADMIN_ROLES.includes(session.user.role)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.query as { id: string };
  const cfDb = db as never as CfDb;

  const field = await cfDb.customFieldDefinition.findUnique({
    where: { id },
  } as never);
  if (!field) return res.status(404).json({ error: "Not found" });

  if (req.method === "GET") {
    return res.status(200).json(field);
  }

  if (req.method === "PUT") {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { options, ...rest } = parsed.data;
    const updated = await cfDb.customFieldDefinition.update({
      where: { id },
      data: {
        ...rest,
        ...(options !== undefined && {
          options: (options?.length ?? 0) > 0 ? (options as never) : null,
        }),
      },
    } as never);
    return res.status(200).json(updated);
  }

  if (req.method === "DELETE") {
    // Check no values exist
    const valueCount = await (db as never as { customFieldValue: { count: (a: unknown) => Promise<number> } })
      .customFieldValue.count({ where: { fieldId: id } } as never);
    if (valueCount > 0) {
      return res.status(409).json({ error: `Cannot delete — ${valueCount} contact value${valueCount !== 1 ? "s" : ""} exist for this field. Deactivate it instead.` });
    }
    await cfDb.customFieldDefinition.delete({ where: { id } } as never);
    return res.status(204).end();
  }

  res.setHeader("Allow", "GET, PUT, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
