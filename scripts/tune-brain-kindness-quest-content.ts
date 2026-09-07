// Tune Your Brain -- Kindness Quest seed content: 10 short, real-world
// kindness missions drawn from the spec's own examples. No options/scoring
// -- accepting and later marking a mission done (via its own dedicated
// mark-done route) is the whole flow. No proof is ever required, and
// nothing here asks for anything that could feel like a chore or a
// performance for someone else to see.

export interface KindnessMissionSeed {
  prompt: string
}

export const KINDNESS_QUEST_MISSIONS: KindnessMissionSeed[] = [
  { prompt: "Give someone a genuine compliment -- something specific you actually noticed." },
  { prompt: "Thank someone who helped you recently, even if it's a little overdue." },
  { prompt: "Send a quick encouraging message to someone who might need it today." },
  { prompt: "Check in on someone you haven't talked to in a while, just to see how they're doing." },
  { prompt: "Help with something small that's easy for you but would genuinely help someone else." },
  { prompt: "Let someone know you appreciate them, in plain and specific terms." },
  { prompt: "Do something thoughtful for someone without being asked." },
  { prompt: "Introduce yourself to someone new, or make a new connection feel welcome." },
  { prompt: "Encourage someone who's working toward a goal -- tell them you believe they can do it." },
  { prompt: "Share something useful you know with someone who could use it." },
]
