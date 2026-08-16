import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const STEP_TYPES = ["WAIT", "SEND_EMAIL", "ADD_TAG", "REMOVE_TAG", "WEBHOOK", "SEND_PUSH", "CONDITION", "EXIT"] as const;

const createSchema = z.object({
  journeyId: z.string(),
  type: z.enum(STEP_TYPES),
  config: z.record(z.unknown()),
  posX: z.number().optional(),
  posY: z.number().optional(),
});

const patchSchema = z.object({
  id: z.string(),
  config: z.record(z.unknown()).optional(),
  action: z.enum(["move_up", "move_down"]).optional(),
  posX: z.number().nullable().optional(),
  posY: z.number().nullable().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // POST — create step
  if (req.method === "POST") {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", issues: parsed.error.flatten() });
    }

    const existing = await db.automationStep.findMany({
      where: { journeyId: parsed.data.journeyId },
      orderBy: { order: "asc" },
      select: { order: true },
    });
    const nextOrder = existing.length > 0 ? existing[existing.length - 1].order + 1 : 1;

    const step = await db.automationStep.create({
      data: {
        journeyId: parsed.data.journeyId,
        type: parsed.data.type,
        config: parsed.data.config as Prisma.InputJsonValue,
        order: nextOrder,
        posX: parsed.data.posX ?? null,
        posY: parsed.data.posY ?? null,
      },
    });

    return res.status(201).json(step);
  }

  // PATCH — update config or reorder
  if (req.method === "PATCH") {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", issues: parsed.error.flatten() });
    }

    const step = await db.automationStep.findUnique({ where: { id: parsed.data.id } });
    if (!step) return res.status(404).json({ error: "Step not found" });

    if (parsed.data.action === "move_up" || parsed.data.action === "move_down") {
      const allSteps = await db.automationStep.findMany({
        where: { journeyId: step.journeyId },
        orderBy: { order: "asc" },
      });
      const idx = allSteps.findIndex((s) => s.id === step.id);
      const swapIdx = parsed.data.action === "move_up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= allSteps.length) {
        return res.status(400).json({ error: "Cannot move in that direction" });
      }
      const swapStep = allSteps[swapIdx];
      // Use a temp negative order to avoid the unique constraint during swap
      await db.$transaction([
        db.automationStep.update({ where: { id: step.id }, data: { order: -1 } }),
        db.automationStep.update({ where: { id: swapStep.id }, data: { order: step.order } }),
        db.automationStep.update({ where: { id: step.id }, data: { order: swapStep.order } }),
      ]);
      const updated = await db.automationStep.findMany({
        where: { journeyId: step.journeyId },
        orderBy: { order: "asc" },
      });
      return res.status(200).json(updated);
    }

    const updateData: Prisma.AutomationStepUpdateInput = {};
    if (parsed.data.config) updateData.config = parsed.data.config as Prisma.InputJsonValue;
    if (parsed.data.posX !== undefined) updateData.posX = parsed.data.posX;
    if (parsed.data.posY !== undefined) updateData.posY = parsed.data.posY;

    if (Object.keys(updateData).length > 0) {
      const updated = await db.automationStep.update({
        where: { id: parsed.data.id },
        data: updateData,
      });
      return res.status(200).json(updated);
    }

    return res.status(200).json(step);
  }

  // DELETE — remove step
  if (req.method === "DELETE") {
    const { id } = req.query as { id?: string };
    if (!id) return res.status(400).json({ error: "Missing id query param" });

    const step = await db.automationStep.findUnique({ where: { id } });
    if (!step) return res.status(404).json({ error: "Step not found" });

    await db.automationStep.delete({ where: { id } });
    return res.status(200).json({ deleted: true });
  }

  res.setHeader("Allow", "POST, PATCH, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
