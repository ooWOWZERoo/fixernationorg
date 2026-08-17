import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { awardPoints, POINTS } from "@/lib/loyalty";

const USERNAME_RE = /^[a-z0-9_]{3,30}$/;

const PutSchema = z.object({
  username: z
    .string()
    .regex(USERNAME_RE, "3–30 chars, lowercase letters, numbers, underscores only")
    .optional()
    .or(z.literal("")),
  headline: z.string().max(120).optional(),
  bio: z.string().max(1000).optional(),
  location: z.string().max(80).optional(),
  avatarUrl: z.string().url().optional().or(z.literal("")),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const userId = session.user.id;

  if (req.method === "GET") {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { username: true, socialProfile: true },
    });
    return res.json(user);
  }

  if (req.method === "PUT") {
    const parsed = PutSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
    }

    const { username, headline, bio, location, avatarUrl } = parsed.data;

    if (username) {
      const taken = await db.user.findFirst({
        where: { username, NOT: { id: userId } },
        select: { id: true },
      });
      if (taken) return res.status(409).json({ error: "That username is already taken" });
    }

    await db.$transaction([
      db.user.update({
        where: { id: userId },
        data: { username: username || null },
      }),
      db.socialProfile.upsert({
        where: { userId },
        create: {
          userId,
          headline: headline ?? null,
          bio: bio ?? null,
          location: location ?? null,
          avatarUrl: avatarUrl || null,
        },
        update: {
          ...(headline !== undefined && { headline: headline || null }),
          ...(bio !== undefined && { bio: bio || null }),
          ...(location !== undefined && { location: location || null }),
          ...(avatarUrl !== undefined && { avatarUrl: avatarUrl || null }),
        },
      }),
    ]);

    // Award profile completion points once — requires username + (bio or headline)
    (async () => {
      const saved = await db.user.findUnique({
        where: { id: userId },
        select: { username: true, socialProfile: { select: { bio: true, headline: true } } },
      });
      const isComplete = !!(saved?.username && (saved.socialProfile?.bio || saved.socialProfile?.headline));
      if (!isComplete) return;
      const alreadyAwarded = await db.loyaltyPoint.findFirst({ where: { userId, reason: "profile_completed" } });
      if (alreadyAwarded) return;
      await awardPoints(userId, POINTS.PROFILE_COMPLETED, "profile_completed");
    })().catch(() => {});

    return res.json({ ok: true });
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ error: "Method not allowed" });
}
