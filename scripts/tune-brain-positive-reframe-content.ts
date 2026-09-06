// Original Tune Your Brain -- Positive Reframe seed content: 15 scenarios,
// 5 per difficulty level (1-3). Every scenario has 4 options with exactly
// one marked bestOption; the explanation is written for the best option
// only and is shown to the member after they answer, regardless of which
// option they picked. Tone follows the spec: constructive, never shaming,
// no severe/medical/trauma content.

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

export const POSITIVE_REFRAME_SCENARIOS: SeedScenario[] = [
  // Difficulty 1
  {
    difficulty: 1,
    category: "Work",
    prompt: "You send an email with a typo in the subject line, right before a big client meeting.",
    options: [
      {
        label: "Everyone catches typos occasionally. I'll fix it and get back to preparing for the meeting.",
        isCorrectOrBest: true,
        explanation:
          "Good perspective. One small typo doesn't define your attention to detail, and fixing it quickly shows you're focused on what actually matters.",
      },
      { label: "This is going to make me look careless in front of the client.", isCorrectOrBest: false },
      { label: "I should have proofread it three times. I always make mistakes like this.", isCorrectOrBest: false },
      { label: "It's not worth thinking about at all.", isCorrectOrBest: false },
    ],
  },
  {
    difficulty: 1,
    category: "Confidence",
    prompt: "You practiced hard for a presentation, but you stumble over a couple of words halfway through.",
    options: [
      { label: "I probably ruined the whole presentation.", isCorrectOrBest: false },
      {
        label: "I prepared well, and I'll keep going. A stumble or two isn't going to undo my prep.",
        isCorrectOrBest: true,
        explanation:
          "Good perspective. One difficult stretch doesn't define your ability to present — the preparation you put in is still there, and finishing strong matters more than one bump.",
      },
      { label: "I'm just not good at public speaking.", isCorrectOrBest: false },
      { label: "It's fine, I won't even notice it happened.", isCorrectOrBest: false },
    ],
  },
  {
    difficulty: 1,
    category: "Relationships",
    prompt: "A coworker doesn't respond to your message for a full day.",
    options: [
      { label: "They must be ignoring me on purpose.", isCorrectOrBest: false },
      { label: "I probably said something wrong.", isCorrectOrBest: false },
      {
        label: "People get busy. I'll follow up tomorrow instead of assuming the worst.",
        isCorrectOrBest: true,
        explanation:
          "Good perspective. A slow reply usually says more about someone's schedule than about you — following up calmly keeps the door open without adding stress.",
      },
      { label: "I won't think about why — I'll just wait indefinitely.", isCorrectOrBest: false },
    ],
  },
  {
    difficulty: 1,
    category: "Work",
    prompt: "You show up five minutes late to a morning meeting because of traffic.",
    options: [
      { label: "Now everyone thinks I'm unreliable.", isCorrectOrBest: false },
      { label: "I should have left earlier — I always mess up mornings.", isCorrectOrBest: false },
      {
        label: "Traffic happens. I'll apologize briefly and get right into the discussion.",
        isCorrectOrBest: true,
        explanation:
          "Good perspective. A short, honest acknowledgment and moving forward is what reliable people actually do — one late arrival isn't a pattern.",
      },
      { label: "It's not a big deal, I won't even mention it.", isCorrectOrBest: false },
    ],
  },
  {
    difficulty: 1,
    category: "Everyday Life",
    prompt: "Your first attempt at a new recipe doesn't turn out the way you hoped.",
    options: [
      { label: "I'm just bad at cooking.", isCorrectOrBest: false },
      { label: "That was a waste of ingredients and time.", isCorrectOrBest: false },
      { label: "I don't need to think about what went wrong.", isCorrectOrBest: false },
      {
        label: "Now I know what to adjust for next time. First tries are for learning, not perfection.",
        isCorrectOrBest: true,
        explanation:
          "Good perspective. Treating a first attempt as information rather than a verdict is exactly how skills improve — the next attempt gets to be better because of this one.",
      },
    ],
  },

  // Difficulty 2
  {
    difficulty: 2,
    category: "Work",
    prompt: "A project you led doesn't get picked for the next phase of funding.",
    options: [
      { label: "This proves my ideas aren't good enough.", isCorrectOrBest: false },
      {
        label: "The decision was about priorities, not about the quality of work my team put in.",
        isCorrectOrBest: true,
        explanation:
          "Good perspective. Funding decisions weigh a lot of factors beyond the work itself — separating the outcome from your team's effort keeps you clear-eyed for the next pitch.",
      },
      { label: "I should have pushed harder in the pitch — this is all on me.", isCorrectOrBest: false },
      { label: "There's no point trying on the next project.", isCorrectOrBest: false },
    ],
  },
  {
    difficulty: 2,
    category: "Confidence",
    prompt: "You ask a question in a group setting and get a quieter response than you expected.",
    options: [
      { label: "That was a bad question to ask.", isCorrectOrBest: false },
      { label: "Everyone probably thinks less of me now.", isCorrectOrBest: false },
      { label: "I should stop asking questions in groups.", isCorrectOrBest: false },
      {
        label: "Maybe the room just needed a moment to think. I'll give people space to respond.",
        isCorrectOrBest: true,
        explanation:
          "Good perspective. A quiet moment after a question is often people processing, not judging — reading it that way keeps you willing to speak up next time too.",
      },
    ],
  },
  {
    difficulty: 2,
    category: "Relationships",
    prompt: "A friend cancels plans with you for the second time this month.",
    options: [
      { label: "They obviously don't value our friendship.", isCorrectOrBest: false },
      { label: "I always get treated this way.", isCorrectOrBest: false },
      {
        label: "Life gets busy for everyone sometimes. I'll check in and see how they're doing.",
        isCorrectOrBest: true,
        explanation:
          "Good perspective. Checking in with curiosity instead of assuming the worst gives the friendship a fair chance, and it opens the door if something else is going on for them.",
      },
      { label: "I won't reach out again.", isCorrectOrBest: false },
    ],
  },
  {
    difficulty: 2,
    category: "Work",
    prompt: "You apply for a promotion and don't get selected this round.",
    options: [
      { label: "I'm clearly not cut out for more responsibility.", isCorrectOrBest: false },
      { label: "They'll never pick me, so there's no point trying again.", isCorrectOrBest: false },
      { label: "It doesn't matter — I didn't really want it anyway.", isCorrectOrBest: false },
      {
        label: "This round wasn't my turn, but I can ask for feedback and keep building toward the next one.",
        isCorrectOrBest: true,
        explanation:
          "Good perspective. Treating this as timing rather than a final verdict, and asking for specific feedback, is exactly how the next round gets easier to win.",
      },
    ],
  },
  {
    difficulty: 2,
    category: "Relationships",
    prompt: "You give feedback to a teammate, and they seem a little defensive afterward.",
    options: [
      { label: "I shouldn't have said anything at all.", isCorrectOrBest: false },
      { label: "Now they're going to be upset with me for a long time.", isCorrectOrBest: false },
      {
        label: "A strong reaction doesn't mean the feedback was wrong. I'll follow up and stay open to their side too.",
        isCorrectOrBest: true,
        explanation:
          "Good perspective. Defensiveness is a common first reaction to feedback, not proof it was unfair — following up with openness usually gets both people to a better place.",
      },
      { label: "That's their problem, not mine to think about.", isCorrectOrBest: false },
    ],
  },

  // Difficulty 3
  {
    difficulty: 3,
    category: "Work",
    prompt: "You've been working extra hours on a project, but your manager asks for another round of revisions.",
    options: [
      { label: "No matter how much I do, it's never going to be enough.", isCorrectOrBest: false },
      { label: "My manager doesn't respect the work I already put in.", isCorrectOrBest: false },
      { label: "I'll just stop putting in extra effort since it doesn't get noticed.", isCorrectOrBest: false },
      {
        label: "More revisions mean the project matters enough to get right, not that my effort so far was wasted.",
        isCorrectOrBest: true,
        explanation:
          "Good perspective. Revisions are usually a sign of investment in getting something right, not a rejection of the work already done — that distinction keeps your motivation intact.",
      },
    ],
  },
  {
    difficulty: 3,
    category: "Relationships",
    prompt: "A close friend seems distant lately, and you're not sure why.",
    options: [
      { label: "I must have done something to push them away.", isCorrectOrBest: false },
      { label: "They're probably done with our friendship.", isCorrectOrBest: false },
      {
        label: "I can ask them directly how they're doing instead of guessing at reasons that might not be true.",
        isCorrectOrBest: true,
        explanation:
          "Good perspective. Directly checking in replaces guessing with real information — most of the time, the reason for distance has nothing to do with the story we invent for it.",
      },
      { label: "I'll just wait and see what happens without asking.", isCorrectOrBest: false },
    ],
  },
  {
    difficulty: 3,
    category: "Everyday Life",
    prompt: "You set a personal goal for the month and only reach about half of it.",
    options: [
      { label: "If I can't hit the whole goal, there's no point setting goals.", isCorrectOrBest: false },
      { label: "This proves I don't have the discipline for this.", isCorrectOrBest: false },
      { label: "I'll just lower my expectations so I never have to try hard again.", isCorrectOrBest: false },
      {
        label: "Half progress is still real progress. I can look at what worked and adjust the plan for next month.",
        isCorrectOrBest: true,
        explanation:
          "Good perspective. Partial progress is data, not failure — using it to adjust the plan is how goals actually get hit over time, even when a single month falls short.",
      },
    ],
  },
  {
    difficulty: 3,
    category: "Work",
    prompt: "During a team discussion, someone points out a flaw in a plan you proposed.",
    options: [
      { label: "I should have thought of everything before bringing it up.", isCorrectOrBest: false },
      { label: "Now the team probably questions my judgment.", isCorrectOrBest: false },
      {
        label: "Catching the flaw now saves everyone time later — that's what a good team discussion is for.",
        isCorrectOrBest: true,
        explanation:
          "Good perspective. A plan improving through discussion is a sign the process is working, not a mark against the person who proposed it — that's exactly why teams review ideas together.",
      },
      { label: "I'll stop proposing ideas so this doesn't happen again.", isCorrectOrBest: false },
    ],
  },
  {
    difficulty: 3,
    category: "Confidence",
    prompt: "You're passed over for a speaking opportunity that went to someone with less experience than you.",
    options: [
      { label: "Experience clearly doesn't matter here, so why bother building it.", isCorrectOrBest: false },
      { label: "They must not think I'm capable of this.", isCorrectOrBest: false },
      { label: "I'll hold onto this and stop offering to help with future opportunities.", isCorrectOrBest: false },
      {
        label: "There could be reasons I don't fully see yet, and I can ask what would make me a stronger candidate next time.",
        isCorrectOrBest: true,
        explanation:
          "Good perspective. Asking directly for what would strengthen your case turns one disappointing decision into useful information for the next opportunity.",
      },
    ],
  },
]
