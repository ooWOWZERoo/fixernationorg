// Shared game registry -- all engines (progression, badges, goals, admin
// lists, Home/Progress widgets, in later phases) iterate this registry or
// key off TbGameKey as data, never a hardcoded per-game switch statement.
// Adding a 7th game means one new enum value + one registry entry; it does
// not touch the reward/badge/goal/reset engines.
//
// Phase 3: all 6 core games now have a real, working play experience. The
// UI side keys off `kind` (the shape of the gameplay loop), never off a
// specific gameKey -- a per-kind player component in
// src/components/tuneBrain handles every game that shares that kind.
//
// This file is imported directly by the tune-your-brain client pages, so it
// must stay free of any `db`/Prisma-touching import (see goalConstants.ts
// for the lesson that made this rule explicit).

export type TbGameKind = "SCENARIO" | "FREE_TEXT" | "MISSION" | "CALM_FOCUS"

export interface TbGameDefinition {
  key: string // a TbGameKey value
  label: string
  shortDescription: string
  iconKey: string
  emoji: string
  routeSlug: string
  kind: TbGameKind
  supportsDifficulty: boolean
  reducedMotionSafe: boolean
}

export const TB_GAME_REGISTRY: Record<string, TbGameDefinition> = {
  POSITIVE_REFRAME: {
    key: "POSITIVE_REFRAME",
    label: "Positive Reframe",
    shortDescription: "Practice meeting everyday setbacks with a clearer, steadier mindset.",
    iconKey: "reframe",
    emoji: "🔄",
    routeSlug: "positive-reframe",
    kind: "SCENARIO",
    supportsDifficulty: true,
    reducedMotionSafe: true,
  },
  GRATITUDE_QUEST: {
    key: "GRATITUDE_QUEST",
    label: "Gratitude Quest",
    shortDescription: "A quick daily prompt to notice something good and jot it down.",
    iconKey: "gratitude",
    emoji: "🌟",
    routeSlug: "gratitude-quest",
    kind: "FREE_TEXT",
    supportsDifficulty: false,
    reducedMotionSafe: true,
  },
  KINDNESS_QUEST: {
    key: "KINDNESS_QUEST",
    label: "Kindness Quest",
    shortDescription: "Take on a small kindness mission, then check in on how it felt.",
    iconKey: "kindness",
    emoji: "🤝",
    routeSlug: "kindness-quest",
    kind: "MISSION",
    supportsDifficulty: false,
    reducedMotionSafe: true,
  },
  CALM_FOCUS: {
    key: "CALM_FOCUS",
    label: "Calm & Focus",
    shortDescription: "A short breathing or focus exercise to reset between tasks.",
    iconKey: "calm",
    emoji: "🌬️",
    routeSlug: "calm-focus",
    kind: "CALM_FOCUS",
    supportsDifficulty: false,
    reducedMotionSafe: false,
  },
  STRENGTH_SPOTTER: {
    key: "STRENGTH_SPOTTER",
    label: "Strength Spotter",
    shortDescription: "Spot the personal strength behind a short everyday scenario.",
    iconKey: "strength",
    emoji: "🔎",
    routeSlug: "strength-spotter",
    kind: "SCENARIO",
    supportsDifficulty: true,
    reducedMotionSafe: true,
  },
  WELLNESS_CHOICES: {
    key: "WELLNESS_CHOICES",
    label: "Wellness Choices",
    shortDescription: "Pick the healthier option in a handful of everyday choices.",
    iconKey: "wellness",
    emoji: "🥗",
    routeSlug: "wellness-choices",
    kind: "SCENARIO",
    supportsDifficulty: true,
    reducedMotionSafe: true,
  },
}

// The 6 playable core games, in registry order -- excludes the 2 reserved
// bonus-game enum values (POSITIVITY_RECALL, BUILD_GOOD_DAY) which have no
// registry entry and stay unused until a later phase.
export const CORE_GAME_KEYS = Object.keys(TB_GAME_REGISTRY)
export const CORE_GAME_COUNT = CORE_GAME_KEYS.length

export function gameKeyForSlug(slug: string): string | null {
  const entry = Object.values(TB_GAME_REGISTRY).find((g) => g.routeSlug === slug)
  return entry?.key ?? null
}
