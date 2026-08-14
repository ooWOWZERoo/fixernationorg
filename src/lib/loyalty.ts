import { db } from "@/lib/db";

export const POINTS = {
  POST_CREATED:        5,
  COMMENT_ADDED:       2,
  EVENT_RSVP:          3,
  REFERRAL_CONVERTED: 10,
  PROFILE_COMPLETED:   5,
} as const;

export async function awardPoints(
  userId: string,
  points: number,
  reason: string,
  resourceId?: string
): Promise<void> {
  try {
    await db.loyaltyPoint.create({
      data: { userId, points, reason, resourceId: resourceId ?? null },
    });
  } catch {
    // fire and forget
  }
}

export async function getTotalPoints(userId: string): Promise<number> {
  const result = await db.loyaltyPoint.aggregate({
    where: { userId },
    _sum: { points: true },
  });
  return result._sum.points ?? 0;
}
