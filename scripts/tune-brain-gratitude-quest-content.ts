// Tune Your Brain -- Gratitude Quest seed content: 13 prompts, one per
// category, covering the spread the spec calls for. No options/correct
// answer for this game -- writing a brief, private response is the whole
// point. Tone matches Positive Reframe: warm, constructive, never
// prescriptive about what someone "should" feel grateful for.

export interface GratitudePrompt {
  category: string
  prompt: string
}

export const GRATITUDE_QUEST_PROMPTS: GratitudePrompt[] = [
  {
    category: "people",
    prompt: "Think of someone who made your day a little easier recently. What did they do?",
  },
  {
    category: "experiences",
    prompt: "What's a moment from the last week or two that you'd like to hold onto a bit longer?",
  },
  {
    category: "nature",
    prompt: "What's something outside -- the sky, the weather, a plant, an animal -- that caught your attention lately?",
  },
  {
    category: "health",
    prompt: "What's one thing your body let you do today, big or small, that you're glad it could do?",
  },
  {
    category: "growth",
    prompt: "What's something you understand or handle better now than you did a year ago?",
  },
  {
    category: "learning",
    prompt: "What's something you learned recently -- from a person, a book, or just figuring it out -- that stuck with you?",
  },
  {
    category: "comfort",
    prompt: "What's a small comfort in your everyday routine that makes things feel a bit more okay?",
  },
  {
    category: "kindness",
    prompt: "When's the last time someone was kind to you in a way you didn't expect?",
  },
  {
    category: "accomplishments",
    prompt: "What's something you finished or followed through on recently, even if no one else noticed?",
  },
  {
    category: "small moments",
    prompt: "What's a tiny, easy-to-miss moment from today that was actually pretty good?",
  },
  {
    category: "opportunities",
    prompt: "What's a chance or opening you've had recently that you're glad came your way?",
  },
  {
    category: "home",
    prompt: "What's something about where you live that makes it feel like yours?",
  },
  {
    category: "community",
    prompt: "Who's a person or group around you that you're glad has your back?",
  },
]
