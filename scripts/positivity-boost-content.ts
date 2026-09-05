import { POSITIVITY_BOOST_CATEGORIES } from "../src/lib/positivityBoostCategories";

export interface SeedMessage {
  content: string;
  category: (typeof POSITIVITY_BOOST_CATEGORIES)[number];
  isFallback?: boolean;
}

// ~100 original Fixer Nation Daily Positivity Boost messages, 5 per category,
// plus a small set of extra-conservative isFallback rows used only when the
// normal eligible pool is exhausted. Every message is positive from its
// first word, avoids the prohibited-term/negative-opener list in
// src/lib/positivityValidator.ts, and makes no medical, personalized, or
// unsupported claims about the reader.
export const POSITIVITY_MESSAGES: SeedMessage[] = [
  // Confidence
  { category: "Confidence", content: "Trust the skills you've already built. They are ready for whatever today brings." },
  { category: "Confidence", content: "You know more than you give yourself credit for. Let that guide your next move." },
  { category: "Confidence", content: "Walk into today's first challenge like someone who has handled hard things before." },
  { category: "Confidence", content: "Your instincts have gotten you this far. Trust them a little more today." },
  { category: "Confidence", content: "Speak up today. Your perspective is worth hearing." },

  // Gratitude
  { category: "Gratitude", content: "Notice one good thing before breakfast. Small moments of gratitude add up fast." },
  { category: "Gratitude", content: "Somewhere today, something will go right. Take a second to actually notice it." },
  { category: "Gratitude", content: "Write down one thing you're grateful for and let it set the tone for your day." },
  { category: "Gratitude", content: "The people who show up for you deserve a quiet thank-you today." },
  { category: "Gratitude", content: "Look for one ordinary moment worth appreciating. It's probably closer than you think." },

  // Joy
  { category: "Joy", content: "Let yourself enjoy something small today, on purpose, without waiting for a reason." },
  { category: "Joy", content: "Play a song you love and let it change your mood for the next ten minutes." },
  { category: "Joy", content: "Find one moment today that makes you smile, and let yourself fully enjoy it." },
  { category: "Joy", content: "Do one thing today purely because it makes you happy." },
  { category: "Joy", content: "Laugh generously today. It's contagious, and someone nearby could use it." },

  // Kindness
  { category: "Kindness", content: "A short kind word costs you nothing and can carry someone through their whole day." },
  { category: "Kindness", content: "Hold the door, send the text, offer the compliment. Small kindness adds up." },
  { category: "Kindness", content: "Someone near you today could use a little extra patience. Offer it freely." },
  { category: "Kindness", content: "Give a genuine compliment today. It takes five seconds and can last much longer." },
  { category: "Kindness", content: "Let someone go first today, literally or figuratively. Generosity is contagious." },

  // Personal Growth
  { category: "Personal Growth", content: "Every skill you practice today becomes a little easier tomorrow. Keep building." },
  { category: "Personal Growth", content: "Learning something new today, however small, is progress worth being proud of." },
  { category: "Personal Growth", content: "Growth rarely announces itself. Trust that today's effort is quietly adding up." },
  { category: "Personal Growth", content: "Try something slightly outside your comfort zone today. That's where growth lives." },
  { category: "Personal Growth", content: "Ask one good question today. Curiosity is one of the best habits you can build." },

  // Healthy Habits
  { category: "Healthy Habits", content: "Choose one small healthy habit today and give it your full attention." },
  { category: "Healthy Habits", content: "Drink a full glass of water before your first cup of coffee today." },
  { category: "Healthy Habits", content: "Take the stairs, stretch for two minutes, step outside. Small habits build real momentum." },
  { category: "Healthy Habits", content: "Give your body what it actually needs today: movement, water, and rest." },
  { category: "Healthy Habits", content: "A short walk today can reset your whole afternoon. Give it a try." },

  // Mindfulness
  { category: "Mindfulness", content: "Slow down for one full breath. Notice where you are and what's around you." },
  { category: "Mindfulness", content: "Put your phone down for five minutes today and just notice your surroundings." },
  { category: "Mindfulness", content: "Eat one meal today without a screen in front of you. Notice how it tastes." },
  { category: "Mindfulness", content: "Pause before you react today. A single breath can change how a moment unfolds." },
  { category: "Mindfulness", content: "Notice the small details around you today. There's more going on than you realize." },

  // Relationships
  { category: "Relationships", content: "Reach out to someone today just to say you were thinking of them." },
  { category: "Relationships", content: "Ask a friend how they're really doing today, and actually listen to the answer." },
  { category: "Relationships", content: "A short phone call today can mean more to someone than you'd expect." },
  { category: "Relationships", content: "Tell someone specifically what you appreciate about them today." },
  { category: "Relationships", content: "Make time for one real conversation today, not just a passing hello." },

  // Purpose
  { category: "Purpose", content: "Your work today, however small it feels, is part of something worth doing." },
  { category: "Purpose", content: "Remind yourself today why you started what you're working on." },
  { category: "Purpose", content: "Do one thing today that connects to what actually matters to you." },
  { category: "Purpose", content: "Today's effort adds to something larger than the day itself." },
  { category: "Purpose", content: "Choose one task today that reflects what you actually care about." },

  // Encouragement
  { category: "Encouragement", content: "Keep going. Every step you take today adds to something real." },
  { category: "Encouragement", content: "You're closer to figuring this out than it might feel right now." },
  { category: "Encouragement", content: "Take today one step at a time. That's how real progress gets made." },
  { category: "Encouragement", content: "Give today your honest effort. That's all anyone can ask, including yourself." },
  { category: "Encouragement", content: "Whatever you're working on, today is a good day to move it forward." },

  // Self-Respect
  { category: "Self-Respect", content: "Speak to yourself the way you'd speak to someone you deeply respect." },
  { category: "Self-Respect", content: "Set one boundary today that protects your time or energy." },
  { category: "Self-Respect", content: "You deserve the same patience today that you'd extend to someone you care about." },
  { category: "Self-Respect", content: "Honor your own limits today. Rest is a legitimate choice." },
  { category: "Self-Respect", content: "Give yourself credit today for showing up, even on an ordinary day." },

  // Optimism
  { category: "Optimism", content: "Good things are still ahead of you today. Stay open to noticing them." },
  { category: "Optimism", content: "Today holds possibilities you haven't discovered yet. Stay curious about what's next." },
  { category: "Optimism", content: "Expect something good today, even something small. It tends to show up." },
  { category: "Optimism", content: "There's more room for good news today than you might expect." },
  { category: "Optimism", content: "Today is full of small openings for something good to happen." },

  // Motivation
  { category: "Motivation", content: "Pick one thing that matters to you and give it real effort today." },
  { category: "Motivation", content: "Start with the smallest possible step today. Momentum builds from there." },
  { category: "Motivation", content: "Today's effort doesn't need to be perfect. It just needs to happen." },
  { category: "Motivation", content: "Give your first hour today your full attention. The rest tends to follow." },
  { category: "Motivation", content: "Commit to one meaningful action today, then let it lead to the next." },

  // Community
  { category: "Community", content: "Being part of a community that wants good things for you matters. Lean into it." },
  { category: "Community", content: "Show up for someone in your community today, even in a small way." },
  { category: "Community", content: "The people around you are rooting for you more than you may realize." },
  { category: "Community", content: "Contribute something today to a group or community you're part of." },
  { category: "Community", content: "You're part of something bigger than yourself. Let that shape today a little." },

  // Compassion
  { category: "Compassion", content: "Offer yourself the same patience you would offer a good friend today." },
  { category: "Compassion", content: "Assume good intentions today, especially with people you don't know well." },
  { category: "Compassion", content: "Someone you meet today may need a little extra patience. Offer it kindly." },
  { category: "Compassion", content: "Offer patience today, both to the people around you and to yourself." },
  { category: "Compassion", content: "A little extra understanding today can change someone's whole afternoon." },

  // Creativity
  { category: "Creativity", content: "Try one new idea today, even a small one. Creativity grows through use." },
  { category: "Creativity", content: "Approach one task today a little differently than you normally would." },
  { category: "Creativity", content: "Give yourself permission to experiment today, even if it doesn't turn out perfectly." },
  { category: "Creativity", content: "Notice something ordinary today and imagine a new way to use it." },
  { category: "Creativity", content: "Make something today, even something small. Creating is its own reward." },

  // Appreciation
  { category: "Appreciation", content: "Take a moment to appreciate someone who made your week a little easier." },
  { category: "Appreciation", content: "Notice the care someone put into something today that you usually take for granted." },
  { category: "Appreciation", content: "Appreciate a small comfort today that you'd otherwise walk right past." },
  { category: "Appreciation", content: "Take a second today to appreciate how far you've already come." },
  { category: "Appreciation", content: "Look for something well-made or well-done today, and really take it in." },

  // Connection
  { category: "Connection", content: "A genuine conversation today can brighten someone's whole day, including yours." },
  { category: "Connection", content: "Look up from your phone today and connect with whoever is nearby." },
  { category: "Connection", content: "Introduce yourself to someone new today. Connection often starts that simply." },
  { category: "Connection", content: "Share something real with someone today instead of just small talk." },
  { category: "Connection", content: "Today is a good day to strengthen a connection you've been meaning to." },

  // Energy
  { category: "Energy", content: "Bring your best energy to the next thing you do, whatever it is." },
  { category: "Energy", content: "Let your energy today come from something you actually care about." },
  { category: "Energy", content: "Start your morning with intention today, and let that energy carry forward." },
  { category: "Energy", content: "Bring a little enthusiasm to something ordinary today. It changes the whole moment." },
  { category: "Energy", content: "Move your body today, even briefly. Energy tends to create more energy." },

  // Achievement
  { category: "Achievement", content: "Recognize what you've already accomplished today, even before the day is done." },
  { category: "Achievement", content: "Finish one thing today, even something small. Completion feels good for a reason." },
  { category: "Achievement", content: "Give yourself credit today for progress, not just for finishing." },
  { category: "Achievement", content: "One completed task today is worth acknowledging, no matter its size." },
  { category: "Achievement", content: "Today is a good day to check one thing off and mean it." },

  // Fallback pool — extra-conservative, always eligible when the normal
  // repetition-protected pool is exhausted. Selected without the usual
  // 90-day exclusion, so intentionally simple and broadly applicable.
  { category: "Optimism", isFallback: true, content: "Today is another opportunity to create something good." },
  { category: "Kindness", isFallback: true, content: "Your kindness, energy, and effort can add something good to today." },
  { category: "Encouragement", isFallback: true, content: "A positive choice today can create a meaningful moment." },
  { category: "Community", isFallback: true, content: "Bring something good into the world today." },
  { category: "Optimism", isFallback: true, content: "Today offers a fresh chance to do something worthwhile." },
  { category: "Encouragement", isFallback: true, content: "Something good can begin with one small, positive choice today." },
];
