import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { validateTuneBrainContentFields } from "@/lib/tuneBrainContentValidator";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const GAME_KEYS = [
  "POSITIVE_REFRAME",
  "GRATITUDE_QUEST",
  "KINDNESS_QUEST",
  "CALM_FOCUS",
  "STRENGTH_SPOTTER",
  "WELLNESS_CHOICES",
  "POSITIVITY_RECALL",
  "BUILD_GOOD_DAY",
] as const;
const TIER_KEYS = ["STARTER", "EXPLORER", "BUILDER", "CHALLENGER", "SKILLED", "ADVANCED", "CHAMPION"] as const;

const createSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers, and underscores only."),
  gameKey: z.enum(GAME_KEYS).optional().nullable(),
  tier: z.enum(TIER_KEYS).optional().nullable(),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(500),
  iconKey: z.string().trim().min(1).max(40),
  sortOrder: z.number().int().min(0).default(0),
  pointsReward: z.number().int().min(0).max(1000).default(0),
  isActive: z.boolean().default(true),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.adminRole || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    const badges = await db.tbBadge.findMany({
      orderBy: [{ gameKey: "asc" }, { sortOrder: "asc" }],
      include: { _count: { select: { userBadges: true } } },
    });
    return res.status(200).json(badges);
  }

  if (req.method === "POST") {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const {
      key,
      gameKey,
      tier,
      name,
      description,
      iconKey,
      sortOrder,
      pointsReward,
      isActive: requestedActive,
    } = parsed.data;

    // Badge copy is still member-facing text -- re-run the same content
    // validator used for game content. TbBadge has no validationStatus
    // column of its own, so isActive is the actual enforcement surface:
    // copy that fails validation can never be created active, regardless
    // of what the request asks for.
    const result = validateTuneBrainContentFields([name, description]);
    let isActive = requestedActive;
    if (!result.passed) {
      if (requestedActive) {
        return res.status(400).json({ error: "Cannot activate a badge whose copy failed validation.", validation: result });
      }
      isActive = false;
    }

    try {
      const badge = await db.tbBadge.create({
        data: {
          key,
          gameKey: gameKey ?? null,
          tier: tier ?? null,
          name,
          description,
          iconKey,
          sortOrder,
          pointsReward,
          isActive,
        },
      });
      return res.status(201).json({ ...badge, validation: result });
    } catch (err: unknown) {
      if (err != null && typeof err === "object" && "code" in err) {
        const code = (err as { code: string }).code;
        if (code === "P2002") {
          return res.status(409).json({ error: "A badge with that key already exists." });
        }
      }
      console.error("Error creating Tune Your Brain badge:", err);
      return res.status(500).json({ error: "An error occurred while creating the badge. Please try again." });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
