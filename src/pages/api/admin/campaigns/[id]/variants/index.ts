import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

type VarDb = {
  campaignVariant: {
    findMany: (a: unknown) => Promise<{
      id: string; name: string; subject: string; fromName: string; fromEmail: string;
      htmlBody: string; textBody: string | null; splitPct: number; createdAt: Date;
    }[]>;
    create: (a: unknown) => Promise<{
      id: string; name: string; subject: string; fromName: string; fromEmail: string;
      htmlBody: string; textBody: string | null; splitPct: number; createdAt: Date;
    }>;
    count: (a: unknown) => Promise<number>;
  };
  campaign: {
    update: (a: unknown) => Promise<unknown>;
  };
};

const createSchema = z.object({
  name: z.string().min(1).max(10),
  subject: z.string().min(1).max(200),
  fromName: z.string().min(1).max(100),
  fromEmail: z.string().email().max(200),
  htmlBody: z.string().min(1),
  textBody: z.string().optional(),
  splitPct: z.number().int().min(1).max(99),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !ADMIN_ROLES.includes(session.user.role)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.query as { id: string };
  const campaign = await db.campaign.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });
  if (campaign.status === "SENDING" || campaign.status === "SENT") {
    return res.status(409).json({ error: "Cannot modify variants of a campaign that is sending or sent" });
  }

  const varDb = db as never as VarDb;

  if (req.method === "GET") {
    const variants = await varDb.campaignVariant.findMany({
      where: { campaignId: id } as never,
      orderBy: { createdAt: "asc" } as never,
    });
    return res.status(200).json(variants.map((v) => ({ ...v, createdAt: v.createdAt.toISOString() })));
  }

  if (req.method === "POST") {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    // Validate total split won't exceed 100 after adding this variant
    const existingCount = await varDb.campaignVariant.count({ where: { campaignId: id } as never });
    if (existingCount >= 3) {
      return res.status(400).json({ error: "Maximum 3 variants (B, C, D) per campaign" });
    }

    const variant = await varDb.campaignVariant.create({
      data: {
        campaignId: id,
        name: parsed.data.name,
        subject: parsed.data.subject,
        fromName: parsed.data.fromName,
        fromEmail: parsed.data.fromEmail,
        htmlBody: parsed.data.htmlBody,
        textBody: parsed.data.textBody ?? null,
        splitPct: parsed.data.splitPct,
      } as never,
    });

    // Auto-enable isAbTest on the campaign when first variant is added
    await varDb.campaign.update({
      where: { id } as never,
      data: { isAbTest: true } as never,
    });

    return res.status(201).json({ ...variant, createdAt: variant.createdAt.toISOString() });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
