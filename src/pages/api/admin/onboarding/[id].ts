import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAction, getClientIp } from "@/lib/audit";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const upsertSchema = z.object({
  pricingType: z
    .enum(["CURRENT", "QUOTED", "PROMOTIONAL", "PARTIAL_DISCOUNT", "FULL_WAIVER", "TRIAL", "COMPLIMENTARY"])
    .optional(),
  quotedAmount: z.number().nonnegative().optional().nullable(),
  finalAmount: z.number().nonnegative().optional().nullable(),
  discountPercent: z.number().min(0).max(100).optional().nullable(),
  paymentStatus: z.enum(["PENDING", "COMPLETED", "WAIVED", "FAILED"]).optional(),
  paidAt: z.string().optional().nullable(),
  stripePaymentIntentId: z.string().max(200).optional().nullable(),
  stripePaymentLinkUrl: z.string().max(500).optional().nullable(),
  waiverReason: z.string().max(1000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // id = applicationId
  const { id } = req.query as { id: string };

  const application = await db.userApplication.findUnique({ where: { id } });
  if (!application) return res.status(404).json({ error: "Application not found" });

  // ── GET ────────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    const record = await db.onboardingRecord.findUnique({ where: { applicationId: id } });
    return res.status(200).json(record ?? null);
  }

  // ── PUT — upsert ──────────────────────────────────────────────────────────
  if (req.method === "PUT") {
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const { paidAt, ...rest } = parsed.data;
    const adminEmail = session.user.email ?? session.user.id;

    const data = {
      ...rest,
      paidAt: paidAt ? new Date(paidAt) : rest.paymentStatus === "COMPLETED" && paidAt === undefined
        ? new Date()
        : paidAt === null ? null : undefined,
    };

    // Remove undefined values for the update path
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined)
    );

    const existing = await db.onboardingRecord.findUnique({ where: { applicationId: id } });

    const record = existing
      ? await db.onboardingRecord.update({
          where: { applicationId: id },
          data: cleanData,
        })
      : await db.onboardingRecord.create({
          data: {
            applicationId: id,
            createdBy: adminEmail,
            pricingType: parsed.data.pricingType ?? "CURRENT",
            quotedAmount: parsed.data.quotedAmount ?? null,
            finalAmount: parsed.data.finalAmount ?? null,
            discountPercent: parsed.data.discountPercent ?? null,
            paymentStatus: parsed.data.paymentStatus ?? "PENDING",
            paidAt: paidAt ? new Date(paidAt) : parsed.data.paymentStatus === "COMPLETED" ? new Date() : null,
            stripePaymentIntentId: parsed.data.stripePaymentIntentId ?? null,
            stripePaymentLinkUrl: parsed.data.stripePaymentLinkUrl ?? null,
            waiverReason: parsed.data.waiverReason ?? null,
            notes: parsed.data.notes ?? null,
          },
        });

    await logAction({
      actorId: session.user.id,
      actorEmail: adminEmail,
      action: "application.onboarding_record_updated",
      resource: "OnboardingRecord",
      resourceId: record.id,
      metadata: {
        applicationId: id,
        paymentStatus: record.paymentStatus,
        pricingType: record.pricingType,
      },
      ip: getClientIp(req),
    });

    return res.status(200).json(record);
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ error: "Method not allowed" });
}
