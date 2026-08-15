import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateUniquePromoCode } from "@/lib/affiliate";
import { logAction, getClientIp } from "@/lib/audit";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const patchStatusSchema = z.object({
  action: z.literal("status"),
  status: z.enum(["PENDING", "ACTIVE", "ON_HOLD", "SUSPENDED", "REVOKED", "CLOSED"]),
  reason: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

const patchSettingsSchema = z.object({
  action: z.literal("settings"),
  attributionWindowDays: z.number().int().min(1).max(365).optional(),
  payoutThreshold: z.number().positive().optional(),
  payoutCycle: z.enum(["MONTHLY", "WEEKLY", "BIWEEKLY"]).optional(),
  taxOnboardingDone: z.boolean().optional(),
  payoutOnboardingDone: z.boolean().optional(),
  stripeConnectId: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

const addPromoSchema = z.object({
  action: z.literal("promo"),
  discountType: z.enum(["PERCENTAGE", "FLAT"]).default("PERCENTAGE"),
  discountValue: z.number().positive(),
  maxUses: z.number().int().positive().optional(),
  validUntil: z.string().optional(),
  notes: z.string().max(500).optional(),
  customCode: z.string().max(40).optional(),
});

const addRuleSchema = z.object({
  action: z.literal("rule"),
  name: z.string().min(1).max(120),
  type: z.enum(["PERCENTAGE", "FLAT"]).default("PERCENTAGE"),
  rate: z.number().positive(),
  pendingDays: z.number().int().min(0).max(365).default(30),
  appliesTo: z.string().max(80).optional(),
});

const deactivateRuleSchema = z.object({
  action: z.literal("deactivate_rule"),
  ruleId: z.string(),
});

const addLedgerSchema = z.object({
  action: z.literal("ledger"),
  sourceType: z.enum(["MANUAL", "BONUS", "REVERSAL"]),
  description: z.string().min(1).max(300),
  grossAmount: z.number(),
  commissionAmount: z.number(),
  commissionRate: z.number().optional(),
  sourceRef: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
  pendingDays: z.number().int().min(0).max(365).default(0),
});

const actionSchema = z.discriminatedUnion("action", [
  patchStatusSchema,
  patchSettingsSchema,
  addPromoSchema,
  addRuleSchema,
  deactivateRuleSchema,
  addLedgerSchema,
]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id } = req.query as { id: string };

  // ── GET ────────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    const affiliate = await db.affiliateAssignment.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        application: { select: { id: true, name: true, email: true, type: true, status: true } },
        promoCodes: { orderBy: { createdAt: "desc" } },
        commissionRules: { orderBy: { createdAt: "asc" } },
        ledgerEntries: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });
    if (!affiliate) return res.status(404).json({ error: "Not found" });
    return res.status(200).json(affiliate);
  }

  // ── PATCH ──────────────────────────────────────────────────────────────────
  if (req.method === "PATCH") {
    const affiliate = await db.affiliateAssignment.findUnique({ where: { id } });
    if (!affiliate) return res.status(404).json({ error: "Not found" });

    const parsed = actionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const adminId = session.user.id;
    const adminEmail = session.user.email ?? session.user.id;
    const ip = getClientIp(req);

    // ── Status change ────────────────────────────────────────────────────────
    if (parsed.data.action === "status") {
      const { status, reason, notes } = parsed.data;
      const now = new Date();

      const updated = await db.affiliateAssignment.update({
        where: { id },
        data: {
          status,
          notes: notes?.trim() || affiliate.notes,
          ...(status === "ACTIVE" && !affiliate.activatedAt ? { activatedAt: now } : {}),
          ...(status === "SUSPENDED" ? { suspendedAt: now, suspendedReason: reason ?? null } : {}),
          ...(status === "REVOKED" ? { revokedAt: now, revokedBy: adminEmail } : {}),
        },
      });

      await logAction({
        actorId: adminId,
        actorEmail: adminEmail,
        action: `affiliate.${status.toLowerCase()}`,
        resource: "AffiliateAssignment",
        resourceId: id,
        metadata: { reason, notes },
        ip,
      });

      return res.status(200).json(updated);
    }

    // ── Settings update ──────────────────────────────────────────────────────
    if (parsed.data.action === "settings") {
      const { action: _a, ...data } = parsed.data;
      const updated = await db.affiliateAssignment.update({
        where: { id },
        data: {
          ...(data.attributionWindowDays !== undefined && { attributionWindowDays: data.attributionWindowDays }),
          ...(data.payoutThreshold !== undefined && { payoutThreshold: data.payoutThreshold }),
          ...(data.payoutCycle !== undefined && { payoutCycle: data.payoutCycle }),
          ...(data.taxOnboardingDone !== undefined && { taxOnboardingDone: data.taxOnboardingDone }),
          ...(data.payoutOnboardingDone !== undefined && { payoutOnboardingDone: data.payoutOnboardingDone }),
          ...(data.stripeConnectId !== undefined && { stripeConnectId: data.stripeConnectId }),
          ...(data.notes !== undefined && { notes: data.notes }),
        },
      });
      return res.status(200).json(updated);
    }

    // ── Add promo code ───────────────────────────────────────────────────────
    if (parsed.data.action === "promo") {
      const { discountType, discountValue, maxUses, validUntil, notes, customCode } = parsed.data;

      let code = customCode?.trim().toUpperCase() ?? null;
      if (code) {
        const taken = await db.promoCode.findUnique({ where: { code } });
        if (taken) return res.status(409).json({ error: "Promo code already in use." });
      } else {
        const user = await db.user.findUnique({
          where: { id: affiliate.userId },
          select: { name: true },
        });
        code = await generateUniquePromoCode(user?.name);
      }

      const promo = await db.promoCode.create({
        data: {
          code,
          affiliateId: id,
          discountType,
          discountValue,
          maxUses: maxUses ?? null,
          validUntil: validUntil ? new Date(validUntil) : null,
          notes: notes?.trim() ?? null,
        },
      });
      return res.status(201).json(promo);
    }

    // ── Add commission rule ──────────────────────────────────────────────────
    if (parsed.data.action === "rule") {
      const { action: _a, ...data } = parsed.data;
      const rule = await db.commissionRule.create({
        data: { ...data, affiliateId: id, appliesTo: data.appliesTo ?? null },
      });
      return res.status(201).json(rule);
    }

    // ── Deactivate commission rule ───────────────────────────────────────────
    if (parsed.data.action === "deactivate_rule") {
      const rule = await db.commissionRule.update({
        where: { id: parsed.data.ruleId },
        data: { active: false },
      });
      return res.status(200).json(rule);
    }

    // ── Manual ledger entry ──────────────────────────────────────────────────
    if (parsed.data.action === "ledger") {
      const { action: _a, pendingDays, ...data } = parsed.data;
      const pendingUntil = pendingDays > 0
        ? new Date(Date.now() + pendingDays * 86400 * 1000)
        : null;

      const entry = await db.commissionLedger.create({
        data: {
          affiliateId: id,
          sourceType: data.sourceType,
          sourceRef: data.sourceRef ?? null,
          description: data.description,
          grossAmount: data.grossAmount,
          commissionRate: data.commissionRate ?? null,
          commissionAmount: data.commissionAmount,
          notes: data.notes ?? null,
          pendingUntil,
          status: pendingUntil ? "PENDING" : "APPROVED",
          ...(pendingUntil ? {} : { approvedAt: new Date(), approvedBy: adminEmail }),
        },
      });

      await logAction({
        actorId: adminId,
        actorEmail: adminEmail,
        action: "affiliate.ledger_entry",
        resource: "CommissionLedger",
        resourceId: entry.id,
        metadata: { sourceType: data.sourceType, commissionAmount: data.commissionAmount },
        ip,
      });

      return res.status(201).json(entry);
    }
  }

  res.setHeader("Allow", "GET, PATCH");
  return res.status(405).json({ error: "Method not allowed" });
}
