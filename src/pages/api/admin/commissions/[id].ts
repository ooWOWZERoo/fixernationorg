import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const TERMINAL_STATUSES = ["PAID", "REVERSED", "CANCELLED"];

const approveSchema = z.object({ action: z.literal("approve") });
const holdSchema = z.object({ action: z.literal("hold"), reason: z.string().max(500).optional() });
const releaseSchema = z.object({ action: z.literal("release") });
const paySchema = z.object({
  action: z.literal("pay"),
  payoutBatchId: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});
const reverseSchema = z.object({
  action: z.literal("reverse"),
  reason: z.string().min(1).max(500),
});

const patchSchema = z.discriminatedUnion("action", [
  approveSchema,
  holdSchema,
  releaseSchema,
  paySchema,
  reverseSchema,
]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { id } = req.query as { id: string };

  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", issues: parsed.error.flatten() });
  }

  const entry = await db.commissionLedger.findUnique({
    where: { id },
    select: { id: true, status: true, affiliateId: true },
  });
  if (!entry) return res.status(404).json({ error: "Not found" });

  if (TERMINAL_STATUSES.includes(entry.status)) {
    return res.status(409).json({ error: `Cannot modify a ${entry.status.toLowerCase()} entry.` });
  }

  const { action } = parsed.data;
  let updateData: Record<string, unknown> = {};
  let auditAction = "";

  if (action === "approve") {
    if (!["PENDING", "ON_HOLD"].includes(entry.status)) {
      return res.status(409).json({ error: "Only PENDING or ON_HOLD entries can be approved." });
    }
    updateData = { status: "APPROVED", approvedAt: new Date(), approvedBy: session.user.id };
    auditAction = "commission.approved";
  }

  if (action === "hold") {
    if (!["PENDING", "APPROVED"].includes(entry.status)) {
      return res.status(409).json({ error: "Only PENDING or APPROVED entries can be put on hold." });
    }
    updateData = { status: "ON_HOLD" };
    if (parsed.data.reason) updateData.notes = parsed.data.reason;
    auditAction = "commission.held";
  }

  if (action === "release") {
    if (entry.status !== "ON_HOLD") {
      return res.status(409).json({ error: "Only ON_HOLD entries can be released." });
    }
    updateData = { status: "PENDING" };
    auditAction = "commission.released";
  }

  if (action === "pay") {
    if (entry.status !== "APPROVED") {
      return res.status(409).json({ error: "Only APPROVED entries can be marked as paid." });
    }
    updateData = {
      status: "PAID",
      paidAt: new Date(),
      payoutBatchId: parsed.data.payoutBatchId ?? null,
    };
    if (parsed.data.notes) updateData.notes = parsed.data.notes;
    auditAction = "commission.paid";
  }

  if (action === "reverse") {
    updateData = {
      status: "REVERSED",
      reversedAt: new Date(),
      reversedBy: session.user.id,
      reversalReason: parsed.data.reason,
    };
    auditAction = "commission.reversed";
  }

  const updated = await db.commissionLedger.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      status: true,
      approvedAt: true,
      paidAt: true,
      reversedAt: true,
      reversalReason: true,
      payoutBatchId: true,
      notes: true,
    },
  });

  logAction({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: auditAction,
    resource: "CommissionLedger",
    resourceId: id,
    metadata: { affiliateId: entry.affiliateId, fromStatus: entry.status, toStatus: updated.status },
  }).catch(console.error);

  return res.status(200).json(updated);
}
