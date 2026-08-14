import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const putSchema = z.object({
  businessName: z.string().max(120).optional(),
  specialty: z.string().max(100).optional(),
  services: z.string().max(1000).optional(),
  website: z.string().url().max(255).or(z.literal("")).optional(),
  phone: z.string().max(30).optional(),
  serviceArea: z.string().max(150).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") {
    res.setHeader("Allow", "PUT");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.user.role !== "PROVIDER") return res.status(403).json({ error: "Forbidden" });

  const parsed = putSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }

  const data = {
    businessName: parsed.data.businessName?.trim() || null,
    specialty: parsed.data.specialty?.trim() || null,
    services: parsed.data.services?.trim() || null,
    website: parsed.data.website?.trim() || null,
    phone: parsed.data.phone?.trim() || null,
    serviceArea: parsed.data.serviceArea?.trim() || null,
  };

  await db.providerProfile.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, ...data },
    update: data,
  });

  return res.status(200).json({ ok: true });
}
