import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const PROVIDER_ROLES = ["PROVIDER", "ADMIN", "SUPER_ADMIN"];

type ProviderContactDb = {
  providerContact: {
    findMany: (a: unknown) => Promise<unknown[]>;
    create: (a: unknown) => Promise<unknown>;
    count: (a: unknown) => Promise<number>;
  };
};

const CreateSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  email: z.string().email().max(255),
  phone: z.string().max(30).optional(),
  notes: z.string().max(2000).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !PROVIDER_ROLES.includes(session.user.role)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const providerUserId = session.user.id;
  const pdb = db as never as ProviderContactDb;

  if (req.method === "GET") {
    const contacts = await pdb.providerContact.findMany({
      where: { providerUserId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        notes: true,
        createdAt: true,
      },
    });
    return res.status(200).json({ contacts });
  }

  if (req.method === "POST") {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
    }

    const { firstName, lastName, email, phone, notes } = parsed.data;

    const existing = await pdb.providerContact.count({
      where: { providerUserId, email: email.toLowerCase().trim() },
    });
    if (existing > 0) {
      return res.status(409).json({ error: "A contact with this email already exists." });
    }

    const contact = await pdb.providerContact.create({
      data: {
        providerUserId,
        firstName: firstName || null,
        lastName: lastName || null,
        email: email.toLowerCase().trim(),
        phone: phone || null,
        notes: notes || null,
      },
    });

    return res.status(201).json({ contact });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
