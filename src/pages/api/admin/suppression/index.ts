import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

type SupDb = {
  suppressionRecord: {
    findMany: (a: unknown) => Promise<{
      id: string; email: string; type: string; reason: string | null;
      source: string | null; suppressedAt: Date; liftedAt: Date | null; liftedBy: string | null;
    }[]>;
    count: (a: unknown) => Promise<number>;
    create: (a: unknown) => Promise<{ id: string; email: string; type: string; reason: string | null; suppressedAt: Date }>;
  };
};

const createSchema = z.object({
  email: z.string().email(),
  reason: z.string().max(500).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supDb = db as never as SupDb;

  if (req.method === "GET") {
    const { q, type, active } = req.query as Record<string, string | undefined>;

    const where: Record<string, unknown> = {};
    if (q) where.email = { contains: q, mode: "insensitive" };
    if (type && ["BOUNCE", "COMPLAINT", "UNSUBSCRIBE", "ADMIN"].includes(type)) where.type = type;
    if (active === "1") where.liftedAt = null;
    if (active === "0") where.liftedAt = { not: null };

    const rows = await supDb.suppressionRecord.findMany({
      where,
      orderBy: { suppressedAt: "desc" } as never,
      take: 200,
    } as never);

    return res.status(200).json(
      rows.map((r) => ({
        id: r.id,
        email: r.email,
        type: r.type,
        reason: r.reason,
        source: r.source,
        suppressedAt: r.suppressedAt.toISOString(),
        liftedAt: r.liftedAt?.toISOString() ?? null,
        liftedBy: r.liftedBy,
        active: r.liftedAt === null,
      }))
    );
  }

  if (req.method === "POST") {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const record = await supDb.suppressionRecord.create({
      data: {
        email: parsed.data.email.toLowerCase().trim(),
        type: "ADMIN",
        reason: parsed.data.reason ?? null,
        source: "admin",
      } as never,
    });

    return res.status(201).json({
      id: record.id,
      email: record.email,
      type: record.type,
      reason: record.reason,
      suppressedAt: record.suppressedAt.toISOString(),
      active: true,
    });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
