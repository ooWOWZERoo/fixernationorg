// Shared game registry -- all engines (progression, badges, goals, admin
// lists, Home/Progress widgets, in later phases) iterate this registry or
// key off TbGameKey as data, never a hardcoded per-game switch statement.
// Adding a 7th game means one new enum value + one registry entry; it does
// not touch the reward/badge/goal/reset engines.
//
// Phase 1: only POSITIVE_REFRAME has a real, working play experience. The
// other 5 core games get accurate metadata now so this registry is a
// complete reference for later phases -- no UI components exist for them
// yet.

export interface TbGameDefinition {
  key: string // a TbGameKey value
  label: string
  shortDescription: string
  iconKey: string
  supportsDifficulty: boolean
  reducedMotionSafe: boolean
}

export const TB_GAME_REGISTRY: Record<string, TbGameDefinition> = {
  POSITIVE_REFRAME: {
    key: "POSITIVE_REFRAME",
    label: "Positive Reframe",
    shortDescription: "Practice meeting everyday setbacks with a clearer, steadier mindset.",
    iconKey: "reframe",
    supportsDifficulty: true,
    reducedMotionSafe: true,
  },
  GRATITUDE_QUEST: {
    key: "GRATITUDE_QUEST",
    label: "Gratitude Quest",
    shortDescription: "A quick daily prompt to notice something good and jot it down.",
    iconKey: "gratitude",
    supportsDifficulty: false,
    reducedMotionSafe: true,
  },
  KINDNESS_QUEST: {
    key: "KINDNESS_QUEST",
    label: "Kindness Quest",
    shortDescription: "Take on a small kindness mission, then check in on how it felt.",
    iconKey: "kindness",
    supportsDifficulty: false,
    reducedMotionSafe: true,
  },
  CALM_FOCUS: {
    key: "CALM_FOCUS",
    label: "Calm & Focus",
    shortDescription: "A short breathing or focus exercise to reset between tasks.",
    iconKey: "calm",
    supportsDifficulty: false,
    reducedMotionSafe: false,
  },
  STRENGTH_SPOTTER: {
    key: "STRENGTH_SPOTTER",
    label: "Strength Spotter",
    shortDescription: "Spot the personal strength behind a short everyday scenario.",
    iconKey: "strength",
    supportsDifficulty: true,
    reducedMotionSafe: true,
  },
  WELLNESS_CHOICES: {
    key: "WELLNESS_CHOICES",
    label: "Wellness Choices",
    shortDescription: "Pick the healthier option in a handful of everyday choices.",
    iconKey: "wellness",
    supportsDifficulty: true,
    reducedMotionSafe: true,
  },
}
