import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { validateTuneBrainContentFields } from "@/lib/tuneBrainContentValidator";
import { TB_GAME_REGISTRY } from "@/lib/tuneBrain/registry";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const optionSchema = z.object({
  label: z.string().trim().min(1).max(500),
  isCorrectOrBest: z.boolean().default(false),
  explanation: z.string().trim().max(1000).optional().nullable(),
});

const updateSchema = z.object({
  category: z.string().trim().max(60).optional().nullable(),
  difficulty: z.number().int().min(1).max(3).optional().nullable(),
  prompt: z.string().trim().min(1).max(2000).optional(),
  payload: z.record(z.unknown()).optional(),
  options: z.array(optionSchema).max(8).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "INACTIVE", "REJECTED"]).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.adminRole || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.query as { id: string };

  const item = await db.tbContentItem.findUnique({
    where: { id },
    include: { options: { orderBy: { order: "asc" } }, _count: { select: { sessions: true } } },
  });
  if (!item) return res.status(404).json({ error: "Not found" });

  if (req.method === "GET") {
    return res.status(200).json(item);
  }

  if (req.method === "PUT") {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { category, difficulty, prompt, payload, options, status: requestedStatus } = parsed.data;
    const gameDef = TB_GAME_REGISTRY[item.gameKey];
    const effectiveOptions = gameDef?.kind === "SCENARIO" ? options : undefined;
    if (gameDef?.kind === "SCENARIO" && effectiveOptions && effectiveOptions.length < 2) {
      return res.status(400).json({ error: "Scenario games need at least 2 answer options." });
    }

    // Re-validate whenever text changes; the full current text (not just
    // the delta) is what gets checked, same rationale as
    // positivity-boosts/[id].ts.
    const nextPrompt = prompt ?? item.prompt;
    const nextOptionsForValidation = effectiveOptions ?? item.options;
    const textFields = [nextPrompt, ...nextOptionsForValidation.flatMap((o) => [o.label, o.explanation])];
    const result = validateTuneBrainContentFields(textFields);
    const validationStatus = result.passed ? "PASSED" : "FAILED";
    const validationNotes = result.notes.join("; ") || null;

    // The one place safety is actually enforced, not just hidden in the UI:
    // content that fails validation can never end up ACTIVE, regardless of
    // what the request asks for. Manually rejecting content that *passed*
    // validation (for editorial reasons) stays allowed.
    let status = requestedStatus ?? item.status;
    if (validationStatus === "FAILED" && status === "ACTIVE") {
      if (requestedStatus === "ACTIVE") {
        return res.status(400).json({ error: "Cannot activate content that failed validation." });
      }
      status = "REJECTED";
    }

    try {
      const updated = await db.$transaction(async (tx) => {
        const saved = await tx.tbContentItem.update({
          where: { id },
          data: {
            ...(category !== undefined && { category }),
            ...(difficulty !== undefined && { difficulty }),
            ...(prompt !== undefined && { prompt }),
            ...(payload !== undefined && { payload: payload as unknown as Prisma.InputJsonValue }),
            status,
            validationStatus,
            validationNotes,
            updatedBy: session.user.id,
          },
        });

        if (effectiveOptions) {
          // Full replace-on-save, not per-option CRUD -- each content item
          // only has ~4 options, so delete-then-recreate in one
          // transaction is simpler and just as correct.
          await tx.tbContentItemOption.deleteMany({ where: { contentItemId: id } });
          await tx.tbContentItemOption.createMany({
            data: effectiveOptions.map((opt, idx) => ({
              contentItemId: id,
              order: idx,
              label: opt.label,
              isCorrectOrBest: opt.isCorrectOrBest,
              explanation: opt.explanation ?? null,
            })),
          });
        }

        return saved;
      });

      return res.status(200).json(updated);
    } catch (err: unknown) {
      console.error("Error updating Tune Your Brain content:", err);
      return res.status(500).json({ error: "An error occurred while saving. Please try again." });
    }
  }

  if (req.method === "DELETE") {
    if (item._count.sessions > 0) {
      return res.status(400).json({ error: "Cannot delete content that members have already played." });
    }
    await db.tbContentItem.delete({ where: { id } });
    return res.status(204).end();
  }

  res.setHeader("Allow", "GET, PUT, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
