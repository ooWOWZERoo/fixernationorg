// Tune Your Brain -- Strength Spotter seed content: 15 scenarios, 5 per
// difficulty level (1-3), each describing someone's action with 4
// strength-name options and exactly one correct. Difficulty rises from an
// obvious match to a more subtle one where a couple of strengths could
// plausibly apply. Same shape as Positive Reframe -- reuses
// TbContentItemOption identically (label = strength name).

export interface SeedOption {
  label: string
  isCorrectOrBest: boolean
  explanation?: string
}

export interface SeedScenario {
  difficulty: 1 | 2 | 3
  category: string
  prompt: string
  options: SeedOption[]
}

export const STRENGTH_SPOTTER_SCENARIOS: SeedScenario[] = [
  // Difficulty 1
  {
    difficulty: 1,
    category: "Kindness",
    prompt:
      "Maria notices a new hire looking lost near the break room and walks over to show them around, even though she barely knows them.",
    options: [
      {
        label: "Kindness",
        isCorrectOrBest: true,
        explanation: "Going out of your way to help someone you don't even know well yet is kindness in a pretty pure form.",
      },
      { label: "Leadership", isCorrectOrBest: false },
      { label: "Curiosity", isCorrectOrBest: false },
      { label: "Reliability", isCorrectOrBest: false },
    ],
  },
  {
    difficulty: 1,
    category: "Persistence",
    prompt: "Jamal keeps practicing his presentation late into the night, even after fumbling the same line three times.",
    options: [
      { label: "Courage", isCorrectOrBest: false },
      {
        label: "Persistence",
        isCorrectOrBest: true,
        explanation: "Sticking with something after repeated stumbles, rather than giving up on it, is persistence.",
      },
      { label: "Patience", isCorrectOrBest: false },
      { label: "Creativity", isCorrectOrBest: false },
    ],
  },
  {
    difficulty: 1,
    category: "Patience",
    prompt: "Priya calmly waits her turn in a long, slow-moving line without getting visibly frustrated.",
    options: [
      { label: "Self-control", isCorrectOrBest: false },
      { label: "Reliability", isCorrectOrBest: false },
      {
        label: "Patience",
        isCorrectOrBest: true,
        explanation: "Staying calm through a slow, mildly annoying wait is a clean example of patience.",
      },
      { label: "Humility", isCorrectOrBest: false },
    ],
  },
  {
    difficulty: 1,
    category: "Honesty",
    prompt: "Devon speaks up in a meeting to admit he made a mistake on the report, even though no one had noticed yet.",
    options: [
      { label: "Courage", isCorrectOrBest: false },
      { label: "Leadership", isCorrectOrBest: false },
      {
        label: "Honesty",
        isCorrectOrBest: true,
        explanation: "Owning a mistake before anyone catches it is honesty -- telling the truth even when it costs you a little.",
      },
      { label: "Self-control", isCorrectOrBest: false },
    ],
  },
  {
    difficulty: 1,
    category: "Compassion",
    prompt: "Sam sits with a friend who's upset and just listens, without trying to fix anything or rush them along.",
    options: [
      { label: "Kindness", isCorrectOrBest: false },
      { label: "Patience", isCorrectOrBest: false },
      {
        label: "Compassion",
        isCorrectOrBest: true,
        explanation: "Sitting with someone's feelings, not just their problem, is compassion.",
      },
      { label: "Gratitude", isCorrectOrBest: false },
    ],
  },
  // Difficulty 2
  {
    difficulty: 2,
    category: "Adaptability",
    prompt:
      "After the team's project got canceled, Tanya was the one who suggested they repurpose the research for next quarter instead of tossing it out.",
    options: [
      { label: "Leadership", isCorrectOrBest: false },
      { label: "Creativity", isCorrectOrBest: false },
      {
        label: "Adaptability",
        isCorrectOrBest: true,
        explanation: "Finding a new use for a plan that fell apart, instead of just stopping, is adaptability.",
      },
      { label: "Persistence", isCorrectOrBest: false },
    ],
  },
  {
    difficulty: 2,
    category: "Curiosity",
    prompt: "Ravi asks a dozen questions about how the new software actually works instead of just clicking through it.",
    options: [
      {
        label: "Curiosity",
        isCorrectOrBest: true,
        explanation: "Wanting to understand how something actually works, not just get it done, is curiosity.",
      },
      { label: "Persistence", isCorrectOrBest: false },
      { label: "Honesty", isCorrectOrBest: false },
      { label: "Reliability", isCorrectOrBest: false },
    ],
  },
  {
    difficulty: 2,
    category: "Humility",
    prompt:
      "Even though the client praised only her manager for the pitch, Elena made sure her follow-up email mentioned her teammate's late-night work on it.",
    options: [
      { label: "Generosity", isCorrectOrBest: false },
      {
        label: "Humility",
        isCorrectOrBest: true,
        explanation: "Not needing the credit for yourself, and making sure it lands on someone else instead, is humility.",
      },
      { label: "Teamwork", isCorrectOrBest: false },
      { label: "Gratitude", isCorrectOrBest: false },
    ],
  },
  {
    difficulty: 2,
    category: "Self-control",
    prompt:
      "When the vendor missed the deadline again, Marcus stayed calm and quietly reworked the schedule instead of firing off an angry email.",
    options: [
      { label: "Patience", isCorrectOrBest: false },
      { label: "Leadership", isCorrectOrBest: false },
      {
        label: "Self-control",
        isCorrectOrBest: true,
        explanation: "Catching a frustrated reaction before it becomes an angry email is self-control in action.",
      },
      { label: "Adaptability", isCorrectOrBest: false },
    ],
  },
  {
    difficulty: 2,
    category: "Creativity",
    prompt: "Instead of reaching for the usual approach, Wei sketched three different ways to solve the packaging problem before picking one.",
    options: [
      { label: "Curiosity", isCorrectOrBest: false },
      { label: "Adaptability", isCorrectOrBest: false },
      {
        label: "Creativity",
        isCorrectOrBest: true,
        explanation: "Generating more than one original approach before settling on one is creativity.",
      },
      { label: "Persistence", isCorrectOrBest: false },
    ],
  },
  // Difficulty 3
  {
    difficulty: 3,
    category: "Reliability",
    prompt: "Noah covered every one of his coworker's shifts for two weeks while she was out, without ever needing to be asked twice.",
    options: [
      { label: "Teamwork", isCorrectOrBest: false },
      { label: "Persistence", isCorrectOrBest: false },
      { label: "Kindness", isCorrectOrBest: false },
      {
        label: "Reliability",
        isCorrectOrBest: true,
        explanation: "Consistently showing up, without needing reminders, is what reliability looks like day to day.",
      },
    ],
  },
  {
    difficulty: 3,
    category: "Compassion",
    prompt: "During a round of layoffs, Grace made a point of checking in on the people leaving the company just as much as the people staying.",
    options: [
      { label: "Leadership", isCorrectOrBest: false },
      { label: "Teamwork", isCorrectOrBest: false },
      {
        label: "Compassion",
        isCorrectOrBest: true,
        explanation: "Caring about the people who no longer directly benefit you is a deeper form of compassion.",
      },
      { label: "Gratitude", isCorrectOrBest: false },
    ],
  },
  {
    difficulty: 3,
    category: "Humility",
    prompt: "When his idea got voted down in the meeting, Felix was the first to build on the idea that replaced it instead of defending his own.",
    options: [
      { label: "Teamwork", isCorrectOrBest: false },
      { label: "Adaptability", isCorrectOrBest: false },
      {
        label: "Humility",
        isCorrectOrBest: true,
        explanation: "Letting go of attachment to your own idea, and genuinely helping a better one succeed, is humility.",
      },
      { label: "Self-control", isCorrectOrBest: false },
    ],
  },
  {
    difficulty: 3,
    category: "Persistence",
    prompt: "Before setting the project aside, Ana asked what specifically wasn't working and adjusted her plan three separate times.",
    options: [
      { label: "Adaptability", isCorrectOrBest: false },
      { label: "Patience", isCorrectOrBest: false },
      { label: "Curiosity", isCorrectOrBest: false },
      {
        label: "Persistence",
        isCorrectOrBest: true,
        explanation: "Trying again, more than once, before giving something up is persistence -- even when each attempt looks different.",
      },
    ],
  },
  {
    difficulty: 3,
    category: "Gratitude",
    prompt: "At the end of a hard year, Ben made a point of naming, out loud, three specific people who'd helped him get through it.",
    options: [
      { label: "Kindness", isCorrectOrBest: false },
      { label: "Teamwork", isCorrectOrBest: false },
      { label: "Humility", isCorrectOrBest: false },
      {
        label: "Gratitude",
        isCorrectOrBest: true,
        explanation: "Actually naming who helped, and how, is gratitude made specific instead of just a general good feeling.",
      },
    ],
  },
]
