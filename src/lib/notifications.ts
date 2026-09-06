import { db } from "@/lib/db"

// Fire-and-forget, matching awardPoints's convention -- a notification
// failure must never affect gameplay/reward correctness. Deliberately
// general-purpose (not Tune-Your-Brain-prefixed): this is the shared
// in-app notification helper, Tune Your Brain is just its first caller.
export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body: string,
  link?: string
): Promise<void> {
  try {
    await db.notification.create({ data: { userId, type, title, body, link: link ?? null } })
  } catch {
    // fire and forget
  }
}
