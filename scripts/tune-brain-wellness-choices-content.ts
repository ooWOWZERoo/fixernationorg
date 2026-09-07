// Tune Your Brain -- Wellness Choices seed content: 15 everyday-wellness
// decision scenarios, 4 options each with exactly one healthier "best"
// pick. Hard content rule (non-negotiable, per the phase plan): no
// diagnosis, no treatment recommendations, no medication guidance, no
// personalized medical advice, no weight-loss prescriptions, no calorie
// targets, no medical claims -- every scenario stays at the level of
// "stand up and stretch" vs "keep working," never anything clinical.

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

export const WELLNESS_CHOICES_SCENARIOS: SeedScenario[] = [
  {
    difficulty: 1,
    category: "Sleep habits",
    prompt: "It's 1am, the next episode is already queued up, and you have an early morning tomorrow.",
    options: [
      { label: "Watch one more -- you can catch up on sleep this weekend.", isCorrectOrBest: false },
      {
        label: "Turn it off and head to bed so you're rested for tomorrow.",
        isCorrectOrBest: true,
        explanation: "Protecting tonight's sleep does more for tomorrow than almost anything else on this list.",
      },
      { label: "Set an alarm even earlier to make up for the lost time.", isCorrectOrBest: false },
      { label: "Stay up since you don't feel tired yet.", isCorrectOrBest: false },
    ],
  },
  {
    difficulty: 1,
    category: "Movement",
    prompt: "You've been sitting at your desk for three hours straight.",
    options: [
      { label: "Push through until lunch -- you're almost done anyway.", isCorrectOrBest: false },
      {
        label: "Stand up and stretch for a minute before getting back to it.",
        isCorrectOrBest: true,
        explanation: "A short stretch break costs almost nothing and gives your body a real reset.",
      },
      { label: "Grab another coffee to power through.", isCorrectOrBest: false },
      { label: "Switch to a different task while staying seated the whole time.", isCorrectOrBest: false },
    ],
  },
  {
    difficulty: 1,
    category: "Hydration",
    prompt: "It's 2pm and you realize all you've had today is coffee.",
    options: [
      {
        label: "Grab a glass of water now.",
        isCorrectOrBest: true,
        explanation: "A simple glass of water is an easy, immediate way to take care of yourself here.",
      },
      { label: "Have another coffee -- that'll do.", isCorrectOrBest: false },
      { label: "Wait until dinner since you're not thirsty right now.", isCorrectOrBest: false },
      { label: "Grab a soda for the extra pick-me-up.", isCorrectOrBest: false },
    ],
  },
  {
    difficulty: 1,
    category: "Balanced eating",
    prompt: "You're hungry and only have about ten minutes before your next meeting.",
    options: [
      { label: "Skip eating -- you'll grab something bigger later.", isCorrectOrBest: false },
      {
        label: "Grab a quick snack that's more than just sugar, like fruit and nuts.",
        isCorrectOrBest: true,
        explanation: "A quick snack with some substance holds you over better than sugar alone or skipping it entirely.",
      },
      { label: "Eat a candy bar from the vending machine.", isCorrectOrBest: false },
      { label: "Just drink coffee to hold you over.", isCorrectOrBest: false },
    ],
  },
  {
    difficulty: 1,
    category: "Rest",
    prompt: "You've powered through back-to-back meetings all morning with no gap between them.",
    options: [
      { label: "Keep going -- the afternoon is packed too.", isCorrectOrBest: false },
      {
        label: "Take five minutes between meetings to just breathe and reset.",
        isCorrectOrBest: true,
        explanation: "Even a five-minute reset between meetings can keep the whole day from running you down.",
      },
      { label: "Eat lunch during the next meeting to save time.", isCorrectOrBest: false },
      { label: "Push lunch back another hour so you can finish more first.", isCorrectOrBest: false },
    ],
  },
  {
    difficulty: 2,
    category: "Screen habits",
    prompt: "It's 11pm, you're scrolling on your phone in bed, and you're not tired yet.",
    options: [
      { label: "Keep scrolling -- it's relaxing.", isCorrectOrBest: false },
      {
        label: "Set the phone down and let your mind wind down instead.",
        isCorrectOrBest: true,
        explanation: "Giving your mind a chance to settle, screen-free, tends to help more than another round of scrolling.",
      },
      { label: "Switch to reading something even longer on the same screen.", isCorrectOrBest: false },
      { label: "Turn up the brightness so it's easier to see.", isCorrectOrBest: false },
    ],
  },
  {
    difficulty: 1,
    category: "Outdoor time",
    prompt: "You've been inside all day and have a short break between tasks.",
    options: [
      {
        label: "Step outside for a few minutes of fresh air.",
        isCorrectOrBest: true,
        explanation: "A few minutes outside is a small, easy way to break up a day spent entirely indoors.",
      },
      { label: "Stay at your desk -- you'll get outside this weekend.", isCorrectOrBest: false },
      { label: "Watch a nature video instead.", isCorrectOrBest: false },
      { label: "Close the blinds so the glare doesn't bother your screen.", isCorrectOrBest: false },
    ],
  },
  {
    difficulty: 2,
    category: "Social connection",
    prompt: "A friend asks if you want to grab coffee, but you've had a long week.",
    options: [
      { label: "Cancel and stay in -- you're always tired lately.", isCorrectOrBest: false },
      {
        label: "Say yes -- a little time with a friend can be its own kind of rest.",
        isCorrectOrBest: true,
        explanation: "Time with someone you like can genuinely recharge you, not just take more energy.",
      },
      { label: "Reply in a few days once you've caught up on sleep.", isCorrectOrBest: false },
      { label: "Invite them over but stay distracted the whole time.", isCorrectOrBest: false },
    ],
  },
  {
    difficulty: 2,
    category: "Work/life balance",
    prompt: "It's 7pm, you're off the clock, and a work email just came in.",
    options: [
      { label: "Answer it right away so it's off your plate.", isCorrectOrBest: false },
      {
        label: "Let it wait until tomorrow and keep the rest of your evening.",
        isCorrectOrBest: true,
        explanation: "Most things really can wait until tomorrow, and protecting your evening is worth it.",
      },
      { label: "Read it now, but tell yourself you won't reply until tomorrow.", isCorrectOrBest: false },
      { label: "Check your inbox every hour just in case something else comes in.", isCorrectOrBest: false },
    ],
  },
  {
    difficulty: 2,
    category: "Reflection",
    prompt: "It's the end of a rough day.",
    options: [
      { label: "Replay everything that went wrong, on a loop.", isCorrectOrBest: false },
      {
        label: "Take a minute to notice one thing that actually went okay today.",
        isCorrectOrBest: true,
        explanation: "Naming even one thing that went okay balances out a day that otherwise felt like a loss.",
      },
      { label: "Distract yourself so you don't have to think about any of it.", isCorrectOrBest: false },
      { label: "Decide the whole day was wasted.", isCorrectOrBest: false },
    ],
  },
  {
    difficulty: 2,
    category: "Everyday stress management",
    prompt: "You're stuck in traffic and about to be late.",
    options: [
      { label: "Grip the wheel and rehearse everything you'll say when you arrive.", isCorrectOrBest: false },
      {
        label: "Take a few slow breaths and accept that some of this is out of your control.",
        isCorrectOrBest: true,
        explanation: "A few slow breaths won't move the traffic, but they keep the wait from wearing you down further.",
      },
      { label: "Call ahead and try to speed up to make up the time.", isCorrectOrBest: false },
      { label: "Turn the radio up loud to drown out how you feel.", isCorrectOrBest: false },
    ],
  },
  {
    difficulty: 2,
    category: "Healthy routines",
    prompt: "You've skipped your usual morning walk for the third day in a row.",
    options: [
      { label: "Decide the routine's broken and stop trying.", isCorrectOrBest: false },
      {
        label: "Just pick it back up today, even a shorter version counts.",
        isCorrectOrBest: true,
        explanation: "Restarting today, even briefly, matters more than waiting for a perfect moment to resume.",
      },
      { label: "Wait until Monday to restart it properly.", isCorrectOrBest: false },
      { label: "Plan a much longer walk to make up for the missed days.", isCorrectOrBest: false },
    ],
  },
  {
    difficulty: 3,
    category: "Sleep habits",
    prompt: "Your room is bright and your phone keeps buzzing right as you're trying to fall asleep.",
    options: [
      {
        label: "Dim the lights and put the phone somewhere you can't easily reach it.",
        isCorrectOrBest: true,
        explanation: "Removing the light and the temptation to check the phone makes it much easier to actually fall asleep.",
      },
      { label: "Leave everything as is -- you'll fall asleep eventually.", isCorrectOrBest: false },
      { label: "Turn on a bright light to check the notification, just in case.", isCorrectOrBest: false },
      { label: "Watch something on the phone to help you get sleepy.", isCorrectOrBest: false },
    ],
  },
  {
    difficulty: 3,
    category: "Movement",
    prompt: "You have a 15-minute gap between two calls.",
    options: [
      { label: "Scroll on your phone the whole time.", isCorrectOrBest: false },
      {
        label: "Take a short walk or stretch to reset your body.",
        isCorrectOrBest: true,
        explanation: "Fifteen minutes is plenty of time to get up and move, and it changes how the next call feels.",
      },
      { label: "Squeeze in one more email.", isCorrectOrBest: false },
      { label: "Sit and worry about the next call.", isCorrectOrBest: false },
    ],
  },
  {
    difficulty: 3,
    category: "Balanced eating",
    prompt: "You're about to eat lunch at your desk while working through emails.",
    options: [
      { label: "Keep working through the whole meal without really noticing you're eating.", isCorrectOrBest: false },
      {
        label: "Step away from the screen for at least part of the meal so you actually notice eating it.",
        isCorrectOrBest: true,
        explanation: "Even a few minutes away from the screen helps you actually notice and enjoy the meal.",
      },
      { label: "Eat as fast as possible to get back to work sooner.", isCorrectOrBest: false },
      { label: "Skip lunch and combine it with dinner later.", isCorrectOrBest: false },
    ],
  },
]
