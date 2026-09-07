// Pure, client-safe reset constants -- deliberately has NO `db`/Prisma
// import. The admin reset UI (a client component) needs these scope/reason
// enums and labels, but must never transitively pull in Postgres's
// Node-only driver into the browser bundle. reset.ts (server-only, does the
// actual DB reads/writes) imports these from here rather than redefining
// them, so there is exactly one source of truth. Same rationale as
// goalConstants.ts vs goals.ts (SP-TB-P2's client-bundle-leak lesson).

export const RESET_SCOPES = ["SINGLE_GAME", "FULL", "BADGE", "GOAL"] as const
export type ResetScope = (typeof RESET_SCOPES)[number]

export const RESET_SCOPE_LABELS: Record<ResetScope, string> = {
  SINGLE_GAME: "Reset one game",
  FULL: "Full reset (everything)",
  BADGE: "Remove one badge",
  GOAL: "Reset a goal",
}

export const RESET_REASONS = [
  "USER_REQUESTED",
  "TESTING",
  "INCORRECT_DATA",
  "SUPPORT_CORRECTION",
  "DUPLICATE_ACTIVITY",
  "ADMINISTRATIVE_CORRECTION",
  "OTHER",
] as const
export type ResetReasonCode = (typeof RESET_REASONS)[number]

export const RESET_REASON_LABELS: Record<ResetReasonCode, string> = {
  USER_REQUESTED: "User requested",
  TESTING: "Testing",
  INCORRECT_DATA: "Incorrect data",
  SUPPORT_CORRECTION: "Support correction",
  DUPLICATE_ACTIVITY: "Duplicate activity",
  ADMINISTRATIVE_CORRECTION: "Administrative correction",
  OTHER: "Other",
}

// Friction scales with blast radius: FULL requires typing the member's own
// email; every other scope only requires typing this fixed word.
export const RESET_CONFIRMATION_WORD = "RESET"

// The exact `reason` strings src/lib/tuneBrain/rewardEngine.ts passes to
// awardPoints() -- a reset reverses points by matching on these, never by
// guessing at a reason string. Kept here (not in reset.ts) because the
// admin user-detail page's client component sums these for display and
// must not import anything that transitively pulls in `@/lib/db`.
export const TB_POINT_REASONS = {
  LEVEL_UP: "TUNE_YOUR_BRAIN_LEVEL_UP",
  BADGE_EARNED: "TUNE_YOUR_BRAIN_BADGE_EARNED",
  GOAL_COMPLETED: "TUNE_YOUR_BRAIN_GOAL_COMPLETED",
} as const
export const TB_ALL_POINT_REASONS = Object.values(TB_POINT_REASONS)

// A reset reversal is always a brand-new row, never a rewrite of history.
export const TB_RESET_POINT_REASON = "TUNE_YOUR_BRAIN_ADMIN_RESET"
