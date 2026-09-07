import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Prisma, type TbGameKey } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { validateTuneBrainContentFields } from "@/lib/tuneBrainContentValidator";
import { TB_GAME_REGISTRY, CORE_GAME_KEYS } from "@/lib/tuneBrain/registry";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const optionSchema = z.object({
  label: z.string().trim().min(1).max(500),
  isCorrectOrBest: z.boolean().default(false),
  explanation: z.string().trim().max(1000).optional().nullable(),
});

// Only the 6 playable core games can have content authored for them here --
// the 2 reserved bonus-game enum values have no registry entry / play
// experience yet, matching CORE_GAME_KEYS's own doc comment.
const createSchema = z.object({
  gameKey: z.enum(CORE_GAME_KEYS as [string, ...string[]]),
  category: z.string().trim().min(1).max(60).optional(),
  difficulty: z.number().int().min(1).max(3).optional(),
  prompt: z.string().trim().min(1).max(2000),
  payload: z.record(z.unknown()).optional(),
  options: z.array(optionSchema).max(8).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.adminRole || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    const { gameKey, status } = req.query as { gameKey?: string; status?: string };
    const where: Record<string, unknown> = {};
    if (gameKey && gameKey !== "ALL") where.gameKey = gameKey;
    if (status && status !== "ALL") where.status = status;

    const items = await db.tbContentItem.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { options: true, sessions: true } } },
    });
    return res.status(200).json(items);
  }

  if (req.method === "POST") {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { gameKey, category, difficulty, prompt, payload, options } = parsed.data;
    const gameDef = TB_GAME_REGISTRY[gameKey];
    if (!gameDef) return res.status(400).json({ error: "Unknown game." });

    // Only SCENARIO-kind games (Positive Reframe, Strength Spotter,
    // Wellness Choices) take answer options -- anything sent for a
    // FREE_TEXT/MISSION/CALM_FOCUS game is dropped rather than accepted
    // into a shape the play experience never reads.
    const effectiveOptions = gameDef.kind === "SCENARIO" ? options ?? [] : [];
    if (gameDef.kind === "SCENARIO" && effectiveOptions.length < 2) {
      return res.status(400).json({ error: "Scenario games need at least 2 answer options." });
    }

    // status/validationStatus are never accepted from the client -- always
    // computed here by the deterministic safety validator, matching
    // positivity-boosts/index.ts's create path.
    const textFields = [prompt, ...effectiveOptions.flatMap((o) => [o.label, o.explanation])];
    const result = validateTuneBrainContentFields(textFields);

    try {
      const created = await db.$transaction(async (tx) => {
        const item = await tx.tbContentItem.create({
          data: {
            gameKey: gameKey as TbGameKey,
            status: result.passed ? "DRAFT" : "REJECTED",
            difficulty: difficulty ?? null,
            category: category ?? null,
            prompt,
            payload: (payload ?? {}) as unknown as Prisma.InputJsonValue,
            validationStatus: result.passed ? "PASSED" : "FAILED",
            validationNotes: result.notes.join("; ") || null,
            createdBy: session.user.id,
            updatedBy: session.user.id,
          },
        });

        if (effectiveOptions.length > 0) {
          await tx.tbContentItemOption.createMany({
            data: effectiveOptions.map((opt, idx) => ({
              contentItemId: item.id,
              order: idx,
              label: opt.label,
              isCorrectOrBest: opt.isCorrectOrBest,
              explanation: opt.explanation ?? null,
            })),
          });
        }

        return item;
      });

      return res.status(201).json(created);
    } catch (err: unknown) {
      console.error("Error creating Tune Your Brain content:", err);
      return res.status(500).json({ error: "An error occurred while creating the content. Please try again." });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
