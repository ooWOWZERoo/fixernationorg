import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const addressSchema = z.object({
  type: z.enum(["HOME", "WORK", "BILLING", "SHIPPING", "OTHER"]).nullable().optional(),
  street: z.string().optional(),
  street2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id, addrId } = req.query as { id: string; addrId: string };

  const address = await db.contactAddress.findFirst({
    where: { id: addrId, contactId: id },
  });
  if (!address) return res.status(404).json({ error: "Address not found" });

  if (req.method === "PUT") {
    const parsed = addressSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { isPrimary, ...rest } = parsed.data;

    if (isPrimary) {
      await db.contactAddress.updateMany({
        where: { contactId: id, id: { not: addrId } },
        data: { isPrimary: false },
      });
    }

    const updated = await db.contactAddress.update({
      where: { id: addrId },
      data: { ...rest, ...(isPrimary !== undefined ? { isPrimary } : {}) },
    });

    return res.status(200).json(updated);
  }

  if (req.method === "DELETE") {
    await db.contactAddress.delete({ where: { id: addrId } });
    return res.status(204).end();
  }

  res.setHeader("Allow", "PUT, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
