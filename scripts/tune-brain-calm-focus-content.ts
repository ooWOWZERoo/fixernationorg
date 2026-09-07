// Tune Your Brain -- Calm & Focus seed content: modeled as a small number
// of TbContentItem rows (one per mode) rather than one-off hardcoded UI,
// consistent with the content-driven pattern the other games use. Content
// here is thin by nature -- config for the client player, not scenarios to
// read.

export interface CalmFocusModeSeed {
  category: string
  prompt: string
  payload: Record<string, unknown>
}

export const CALM_FOCUS_MODES: CalmFocusModeSeed[] = [
  {
    category: "breathing",
    prompt: "Pick a length of time and follow the breathing cycle -- breathe in, hold, breathe out.",
    payload: { durationOptions: [30, 60, 120, 180, 300] },
  },
  {
    category: "notice",
    prompt: "Slow down for a moment and notice what's around you right now.",
    payload: {
      prompts: [
        "Notice five things you can see around you right now.",
        "Notice four things you can feel -- a texture, your feet on the floor, the temperature of the air.",
        "Notice three things you can hear.",
      ],
    },
  },
]
