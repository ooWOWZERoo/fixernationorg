import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const addressSchema = z.object({
  type: z.enum(["HOME", "WORK", "BILLING", "SHIPPING", "OTHER"]).optional(),
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
  if (!session?.user?.role || !ADMIN_ROLES.includes(session.user.role)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.query as { id: string };

  const contact = await db.contact.findUnique({ where: { id }, select: { id: true } });
  if (!contact) return res.status(404).json({ error: "Contact not found" });

  if (req.method === "POST") {
    const parsed = addressSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { isPrimary, ...rest } = parsed.data;

    if (isPrimary) {
      await db.contactAddress.updateMany({
        where: { contactId: id },
        data: { isPrimary: false },
      });
    }

    const address = await db.contactAddress.create({
      data: { contactId: id, ...rest, isPrimary: isPrimary ?? false },
    });

    return res.status(201).json(address);
  }

  res.setHeader("Allow", "POST");
  return res.status(405).json({ error: "Method not allowed" });
}
