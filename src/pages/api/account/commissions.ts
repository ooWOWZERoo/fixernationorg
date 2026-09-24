import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// Providers intentionally have no commissions view, even when they hold an
// affiliate assignment.
const COMMISSION_ROLES: string[] = ["AMBASSADOR", "AFFILIATE"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (!COMMISSION_ROLES.includes(session.user.role)) return res.status(403).json({ error: "Forbidden" });

  // A user can end up with more than one AffiliateAssignment (e.g. an old
  // Ambassador application plus a later standalone Affiliate application) --
  // prefer their ACTIVE one, falling back to the most recent, rather than an
  // arbitrary unordered row.
  const affiliateSelect = { id: true, status: true, payoutCycle: true, payoutThreshold: true } as const;
  const affiliate =
    (await db.affiliateAssignment.findFirst({
      where: { userId: session.user.id, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      select: affiliateSelect,
    })) ??
    (await db.affiliateAssignment.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: affiliateSelect,
    }));

  if (!affiliate) return res.status(404).json({ error: "No affiliate account found." });

  const entries = await db.commissionLedger.findMany({
    where: { affiliateId: affiliate.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      sourceType: true,
      description: true,
      commissionAmount: true,
      currency: true,
      pendingUntil: true,
      approvedAt: true,
      paidAt: true,
      createdAt: true,
    },
  });

  const toNum = (d: unknown) => parseFloat(String(d));

  const pendingTotal = entries
    .filter((e) => e.status === "PENDING")
    .reduce((sum, e) => sum + toNum(e.commissionAmount), 0);

  const approvedTotal = entries
    .filter((e) => e.status === "APPROVED")
    .reduce((sum, e) => sum + toNum(e.commissionAmount), 0);

  const paidTotal = entries
    .filter((e) => e.status === "PAID")
    .reduce((sum, e) => sum + toNum(e.commissionAmount), 0);

  return res.status(200).json({
    affiliate: {
      status: affiliate.status,
      payoutCycle: affiliate.payoutCycle,
      payoutThreshold: affiliate.payoutThreshold ? toNum(affiliate.payoutThreshold) : null,
    },
    totals: { pending: pendingTotal, approved: approvedTotal, paid: paidTotal },
    entries: entries.map((e) => ({
      id: e.id,
      status: e.status,
      sourceType: e.sourceType,
      description: e.description,
      commissionAmount: toNum(e.commissionAmount),
      currency: e.currency,
      pendingUntil: e.pendingUntil?.toISOString() ?? null,
      approvedAt: e.approvedAt?.toISOString() ?? null,
      paidAt: e.paidAt?.toISOString() ?? null,
      createdAt: e.createdAt.toISOString(),
    })),
  });
}
