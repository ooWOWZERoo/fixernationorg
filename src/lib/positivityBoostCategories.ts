// Single source of truth for Daily Positivity Boost categories, shared by
// the admin forms, the API zod schemas, and the seed script. A plain string
// array (not a Prisma enum) so new categories never require a migration.
export const POSITIVITY_BOOST_CATEGORIES = [
  "Confidence",
  "Gratitude",
  "Joy",
  "Kindness",
  "Personal Growth",
  "Healthy Habits",
  "Mindfulness",
  "Relationships",
  "Purpose",
  "Encouragement",
  "Self-Respect",
  "Optimism",
  "Motivation",
  "Community",
  "Compassion",
  "Creativity",
  "Appreciation",
  "Connection",
  "Energy",
  "Achievement",
] as const;

export type PositivityBoostCategory = (typeof POSITIVITY_BOOST_CATEGORIES)[number];
