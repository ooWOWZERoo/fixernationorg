import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

type VarDb = {
  campaignVariant: {
    findUnique: (a: unknown) => Promise<{ id: string; campaignId: string } | null>;
    update: (a: unknown) => Promise<{
      id: string; name: string; subject: string; fromName: string; fromEmail: string;
      htmlBody: string; textBody: string | null; splitPct: number; createdAt: Date;
    }>;
    delete: (a: unknown) => Promise<unknown>;
    count: (a: unknown) => Promise<number>;
  };
  campaign: {
    update: (a: unknown) => Promise<unknown>;
  };
};

const updateSchema = z.object({
  subject: z.string().min(1).max(200).optional(),
  fromName: z.string().min(1).max(100).optional(),
  fromEmail: z.string().email().max(200).optional(),
  htmlBody: z.string().min(1).optional(),
  textBody: z.string().nullable().optional(),
  splitPct: z.number().int().min(1).max(99).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id, variantId } = req.query as { id: string; variantId: string };
  const varDb = db as never as VarDb;

  const variant = await varDb.campaignVariant.findUnique({ where: { id: variantId } as never });
  if (!variant) return res.status(404).json({ error: "Variant not found" });
  if (variant.campaignId !== id) return res.status(403).json({ error: "Forbidden" });

  const campaign = await db.campaign.findUnique({ where: { id }, select: { status: true } });
  if (campaign?.status === "SENDING" || campaign?.status === "SENT") {
    return res.status(409).json({ error: "Cannot modify variants of a sent campaign" });
  }

  if (req.method === "PUT") {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const updated = await varDb.campaignVariant.update({
      where: { id: variantId } as never,
      data: parsed.data as never,
    });
    return res.status(200).json({ ...updated, createdAt: updated.createdAt.toISOString() });
  }

  if (req.method === "DELETE") {
    await varDb.campaignVariant.delete({ where: { id: variantId } as never });

    // If no variants remain, disable isAbTest
    const remaining = await varDb.campaignVariant.count({ where: { campaignId: id } as never });
    if (remaining === 0) {
      await varDb.campaign.update({
        where: { id } as never,
        data: { isAbTest: false } as never,
      });
    }

    return res.status(204).end();
  }

  res.setHeader("Allow", "PUT, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
