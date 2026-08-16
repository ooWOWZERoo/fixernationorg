import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { provisionAffiliate } from "@/lib/affiliate";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const provisionSchema = z.object({
  userId: z.string(),
  applicationId: z.string(),
  affiliateType: z.enum(["AMBASSADOR", "PROVIDER"]),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // ── GET — list affiliates ─────────────────────────────────────────────────
  if (req.method === "GET") {
    const { status, type, q } = req.query as Record<string, string>;

    const affiliates = await db.affiliateAssignment.findMany({
      where: {
        ...(status && { status: status as "PENDING" | "ACTIVE" | "ON_HOLD" | "SUSPENDED" | "REVOKED" | "CLOSED" }),
        ...(type && { affiliateType: type }),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        application: { select: { id: true, name: true, email: true, type: true } },
        _count: { select: { promoCodes: true, ledgerEntries: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const filtered = q
      ? affiliates.filter((a) => {
          const lq = q.toLowerCase();
          return (
            (a.user.name ?? "").toLowerCase().includes(lq) ||
            a.user.email.toLowerCase().includes(lq)
          );
        })
      : affiliates;

    return res.status(200).json(filtered);
  }

  // ── POST — manual provision ───────────────────────────────────────────────
  if (req.method === "POST") {
    const parsed = provisionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const { userId, applicationId, affiliateType } = parsed.data;

    // Verify application exists
    const application = await db.userApplication.findUnique({ where: { id: applicationId } });
    if (!application) return res.status(404).json({ error: "Application not found" });

    const affiliate = await provisionAffiliate({
      userId,
      applicationId,
      affiliateType,
      assignedBy: session.user.email ?? session.user.id,
    });

    return res.status(201).json(affiliate);
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
