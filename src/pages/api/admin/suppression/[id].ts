import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

type SupDb = {
  suppressionRecord: {
    findUnique: (a: unknown) => Promise<{ id: string; liftedAt: Date | null } | null>;
    update: (a: unknown) => Promise<{ id: string; email: string; type: string; liftedAt: Date | null }>;
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query as { id: string };
  const supDb = db as never as SupDb;

  const record = await supDb.suppressionRecord.findUnique({ where: { id } as never });
  if (!record) return res.status(404).json({ error: "Not found" });
  if (record.liftedAt) return res.status(409).json({ error: "Already lifted" });

  const updated = await supDb.suppressionRecord.update({
    where: { id } as never,
    data: { liftedAt: new Date(), liftedBy: session.user.id } as never,
  });

  return res.status(200).json({ ...updated, active: false });
}
