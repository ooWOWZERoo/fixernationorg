import { db } from "@/lib/db";
import { enrollInJourneys } from "@/lib/automation";

export const POINTS = {
  POST_CREATED:        5,
  COMMENT_ADDED:       2,
  EVENT_RSVP:          3,
  REFERRAL_CONVERTED: 10,
  PROFILE_COMPLETED:   5,
} as const;

const MILESTONES = [100, 250, 500, 1000];

export async function awardPoints(
  userId: string,
  points: number,
  reason: string,
  resourceId?: string
): Promise<void> {
  try {
    const prevResult = await db.loyaltyPoint.aggregate({
      where: { userId },
      _sum: { points: true },
    });
    const prevTotal = prevResult._sum.points ?? 0;

    await db.loyaltyPoint.create({
      data: { userId, points, reason, resourceId: resourceId ?? null },
    });

    const newTotal = prevTotal + points;

    for (const milestone of MILESTONES) {
      if (prevTotal < milestone && newTotal >= milestone) {
        enrollInJourneys({
          trigger: "LOYALTY_MILESTONE" as never,
          userId,
          triggerConfig: { threshold: String(milestone) },
        }).catch(() => {});
      }
    }
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
