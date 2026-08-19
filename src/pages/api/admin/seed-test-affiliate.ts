/**
 * One-time endpoint to seed a test AffiliateAssignment for the QA ambassador
 * account, bypassing the full application-provisioning flow (which requires
 * a real application, acceptance, etc). Idempotent — finds or creates by
 * userId. POST /api/admin/seed-test-affiliate — SUPER_ADMIN only.
 * Remove this file after the affiliate record is confirmed created.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const AMBASSADOR_EMAIL = "qa-ambassador@fixernation.org";

type AffiliateRow = { id: string; userId: string };
type AffiliateDb = {
  affiliateAssignment: {
    findFirst: (a: unknown) => Promise<AffiliateRow | null>;
    create: (a: unknown) => Promise<AffiliateRow>;
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (session?.user?.adminRole !== "SUPER_ADMIN") {
    return res.status(401).json({ error: "SUPER_ADMIN required" });
  }

  const ambassador = await db.user.findUnique({ where: { email: AMBASSADOR_EMAIL } });
  if (!ambassador) {
    return res.status(404).json({ error: `${AMBASSADOR_EMAIL} not found — create it first` });
  }

  const db_ = db as never as AffiliateDb;
  const existing = await db_.affiliateAssignment.findFirst({ where: { userId: ambassador.id } });
  const affiliate = existing
    ? existing
    : await db_.affiliateAssignment.create({
        data: {
          userId: ambassador.id,
          affiliateType: "AMBASSADOR",
          status: "ACTIVE",
          activatedAt: new Date(),
          assignedBy: session.user.id,
        },
      });

  return res.json({ ok: true, id: affiliate.id, userId: affiliate.userId });
}
