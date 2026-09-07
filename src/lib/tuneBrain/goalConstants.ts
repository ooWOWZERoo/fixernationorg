// Pure, client-safe goal constants + date math -- deliberately has NO
// `db`/Prisma import. goals.ts (server-only, writes to the DB) and the
// tune-your-brain page's client component ("My Goals" section) both need
// these keys/labels, but the page component can't import anything that
// transitively pulls in Postgres's Node-only driver into the browser
// bundle. Keep this file free of any db-touching import.

export const DAY_MS = 24 * 60 * 60 * 1000

export const DAILY_GOAL_KEY = "daily_any_session"
export const WEEKLY_GOAL_KEY = "weekly_3_sessions"
export const PERSONAL_REFRAME_BUILDER_KEY = "personal_reframe_builder"

export const GOAL_LABELS: Record<string, string> = {
  [DAILY_GOAL_KEY]: "Complete a Brain Builder session today",
  [WEEKLY_GOAL_KEY]: "Complete 3 Brain Builder sessions this week",
  [PERSONAL_REFRAME_BUILDER_KEY]: "Reach Builder tier in Positive Reframe",
}

export function mondayOf(date: Date): Date {
  const dow = date.getUTCDay() // 0=Sun..6=Sat
  const daysSinceMonday = (dow + 6) % 7
  return new Date(date.getTime() - daysSinceMonday * DAY_MS)
}
