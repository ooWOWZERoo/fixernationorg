/**
 * Phase 2 content seed — run once after SP-54–SP-62 deploy
 * npx dotenv -e .env.seed -- npx tsx scripts/seed-phase2.ts
 */
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

async function main() {
  console.log("Seeding Phase 2 content...")

  // ── Focus Areas ──────────────────────────────────────────────────────────────
  // Only create if none exist
  const focusAreaCount = await db.focusArea.count()
  let focusAreas: { id: string; name: string }[] = []

  if (focusAreaCount === 0) {
    console.log("Creating focus areas...")
    const names = [
      "Career & Professional Growth",
      "Financial Wellness",
      "Health & Fitness",
      "Relationships & Community",
      "Personal Development",
      "Entrepreneurship",
      "Education & Skills",
    ]
    focusAreas = await Promise.all(
      names.map((name, i) => db.focusArea.create({ data: { name, order: i, active: true } }))
    )
    console.log(`  ✓ ${focusAreas.length} focus areas`)
  } else {
    focusAreas = await db.focusArea.findMany({ where: { active: true }, orderBy: { order: "asc" } })
    console.log(`  ↩ ${focusAreas.length} focus areas already exist`)
  }

  const fa = Object.fromEntries(focusAreas.map((f) => [f.name, f.id]))

  // ── Growth Pathways ───────────────────────────────────────────────────────────
  const existingPathways = await db.growthPathway.count()
  if (existingPathways === 0) {
    console.log("Creating growth pathways...")

    const pathways = [
      {
        title: "Launch Your Career",
        slug: "launch-your-career",
        summary: "A step-by-step path for professionals ready to level up their career trajectory.",
        description:
          "Whether you're starting out or pivoting, this pathway walks you through clarifying your goals, building your brand, and landing the opportunities you want.",
        focusAreaId: fa["Career & Professional Growth"],
        durationWeeks: 8,
        active: true,
        loyaltyPoints: 100,
        stages: [
          { title: "Know where you're going", description: "Define your career goals and what success looks like for you.", order: 1, durationDays: 7 },
          { title: "Build your story", description: "Craft your professional narrative — resume, LinkedIn, and elevator pitch.", order: 2, durationDays: 10 },
          { title: "Expand your network", description: "Identify 10 people to reach out to and start real conversations.", order: 3, durationDays: 7 },
          { title: "Apply with intention", description: "Target the right roles, customize your outreach, and track your pipeline.", order: 4, durationDays: 14 },
          { title: "Prepare and show up", description: "Interview prep, offer negotiation, and making the most of day one.", order: 5, durationDays: 7 },
        ],
      },
      {
        title: "Build Your Financial Foundation",
        slug: "build-your-financial-foundation",
        summary: "Get your money sorted — budgeting, debt, savings, and the habits that make it stick.",
        description:
          "Financial wellness isn't about being perfect — it's about building a system that works for your life. This pathway covers the fundamentals and helps you make real progress.",
        focusAreaId: fa["Financial Wellness"],
        durationWeeks: 6,
        active: true,
        loyaltyPoints: 100,
        stages: [
          { title: "See where you stand", description: "Get a clear picture of your income, expenses, and net worth.", order: 1, durationDays: 5 },
          { title: "Build a budget that fits", description: "Create a realistic spending plan you can actually follow.", order: 2, durationDays: 7 },
          { title: "Attack your debt", description: "Choose a debt payoff strategy and start making real progress.", order: 3, durationDays: 10 },
          { title: "Start saving consistently", description: "Set up an emergency fund and automate your savings.", order: 4, durationDays: 10 },
          { title: "Make your money grow", description: "Introduction to investing and building long-term wealth.", order: 5, durationDays: 10 },
        ],
      },
      {
        title: "Commit to Your Health",
        slug: "commit-to-your-health",
        summary: "Build sustainable habits around movement, nutrition, and recovery.",
        description:
          "Health isn't a destination — it's a practice. This pathway helps you create realistic routines around exercise, eating, sleep, and stress that you can keep going.",
        focusAreaId: fa["Health & Fitness"],
        durationWeeks: 6,
        active: true,
        loyaltyPoints: 100,
        stages: [
          { title: "Start with movement", description: "Find a form of movement you enjoy and build a simple routine around it.", order: 1, durationDays: 7 },
          { title: "Eat with intention", description: "Understand your eating patterns and make one meaningful change.", order: 2, durationDays: 10 },
          { title: "Fix your sleep", description: "Build a consistent sleep schedule and eliminate the habits disrupting your rest.", order: 3, durationDays: 7 },
          { title: "Manage your stress", description: "Identify your main stress triggers and build a practical response toolkit.", order: 4, durationDays: 7 },
          { title: "Make it last", description: "Review your progress and lock in the habits worth keeping for good.", order: 5, durationDays: 7 },
        ],
      },
    ]

    for (const p of pathways) {
      const { stages, ...pathwayData } = p
      const pathway = await db.growthPathway.create({ data: pathwayData })
      await Promise.all(
        stages.map((s) => db.pathwayStage.create({ data: { ...s, pathwayId: pathway.id } }))
      )
      console.log(`  ✓ Pathway: ${pathway.title}`)
    }
  } else {
    console.log(`  ↩ ${existingPathways} pathways already exist`)
  }

  // ── Challenges ────────────────────────────────────────────────────────────────
  const existingChallenges = await db.challenge.count()
  if (existingChallenges === 0) {
    console.log("Creating challenges...")

    const challenges = [
      {
        title: "30-Day Morning Momentum Challenge",
        slug: "30-day-morning-momentum",
        summary: "Build a morning routine that sets you up to win every day.",
        description:
          "Your morning is the one part of the day fully in your control. Over 30 days, you'll build a simple routine — movement, intention-setting, and one focused task — that compounds into real momentum.",
        focusAreaIds: [fa["Personal Development"], fa["Health & Fitness"]].filter(Boolean),
        durationDays: 30,
        active: true,
        startMode: "EVERGREEN" as const,
        loyaltyPoints: 150,
        steps: Array.from({ length: 7 }, (_, i) => ({
          day: i + 1,
          title: [
            "Wake up on time — no snooze",
            "Move for 10 minutes",
            "Write down your one priority for today",
            "Drink water before coffee",
            "No phone for the first 30 minutes",
            "Do your hardest task first",
            "Reflect: what worked this week?",
          ][i],
          description: [
            "Set one alarm. When it goes off, your feet hit the floor. That's it.",
            "Walk, stretch, jump — anything for 10 minutes. It doesn't have to be intense.",
            "One priority. Not a list. The one thing that matters most today.",
            "A full glass of water before your first cup of coffee. Simple, but it works.",
            "Your morning is yours before the world demands a piece of it. Protect it.",
            "Eat the frog. Your energy is highest in the morning — use it on the hard thing.",
            "Five minutes to look back at the week. What are you keeping? What's changing?",
          ][i],
          order: i + 1,
          reflectionPrompt: "How did today go? What made it easier or harder?",
        })),
      },
      {
        title: "7-Day Financial Check-In",
        slug: "7-day-financial-check-in",
        summary: "Seven days to get honest about your money and make one real change.",
        description:
          "Most people avoid looking at their finances because it feels overwhelming. This 7-day challenge breaks it down into one simple step per day — by the end, you'll have a clear picture and a plan.",
        focusAreaIds: [fa["Financial Wellness"]].filter(Boolean),
        durationDays: 7,
        active: true,
        startMode: "EVERGREEN" as const,
        loyaltyPoints: 50,
        steps: Array.from({ length: 7 }, (_, i) => ({
          day: i + 1,
          title: [
            "List every account you have",
            "Find out your total debt",
            "Track every dollar you spent last week",
            "Calculate what you actually bring home monthly",
            "Identify your top 3 spending categories",
            "Find one subscription you can cut",
            "Set one financial goal for the next 90 days",
          ][i],
          description: [
            "Checking, savings, credit cards, loans, retirement — write them all down with current balances.",
            "Add up every debt balance. Car, student loans, credit cards, everything. No judgment.",
            "Pull your bank and card statements. Categorize every transaction from the last 7 days.",
            "After taxes and deductions — what actually hits your account each month?",
            "Food? Subscriptions? Eating out? Knowing where it goes is the first step to changing it.",
            "Look at your subscriptions. Find one you haven't used this month. Cancel it today.",
            "Make it specific and achievable. 'Save $500', 'Pay off X card', 'Build a $1k emergency fund'.",
          ][i],
          order: i + 1,
          reflectionPrompt: "What surprised you today? What felt uncomfortable and why?",
        })),
      },
      {
        title: "21-Day Relationship Reset",
        slug: "21-day-relationship-reset",
        summary: "Invest in the relationships that matter and build new ones worth keeping.",
        description:
          "Relationships don't maintain themselves. Over 21 days, you'll reconnect with people you've let drift, deepen relationships that matter, and take real steps toward the community you want.",
        focusAreaIds: [fa["Relationships & Community"]].filter(Boolean),
        durationDays: 21,
        active: true,
        startMode: "EVERGREEN" as const,
        loyaltyPoints: 100,
        steps: Array.from({ length: 7 }, (_, i) => ({
          day: i + 1,
          title: [
            "Name your 5 most important relationships",
            "Reach out to someone you've been meaning to call",
            "Do something kind for someone without telling anyone",
            "Have a real conversation (not small talk)",
            "Meet one new person",
            "Express genuine appreciation to someone",
            "Reflect: what kind of friend, partner, or colleague are you being?",
          ][i],
          description: [
            "Family, friends, colleagues, mentors — who are the five people you want to invest in most?",
            "You know the name. You've thought about it. Text them right now.",
            "Something that takes real effort. Not a quick like — an action.",
            "Ask a real question. Listen without thinking about what you'll say next.",
            "An event, a introduction, a conversation online — make contact.",
            "Not a compliment. A genuine statement of what they mean to you.",
            "The people around you reflect who you're becoming. Are you showing up the way you want to?",
          ][i],
          order: i + 1,
          reflectionPrompt: "What came up for you today? What's one thing you want to carry forward?",
        })),
      },
    ]

    for (const c of challenges) {
      const { steps, ...challengeData } = c
      const challenge = await db.challenge.create({ data: challengeData })
      await Promise.all(
        steps.map((s) => db.challengeStep.create({ data: { ...s, challengeId: challenge.id } }))
      )
      console.log(`  ✓ Challenge: ${challenge.title}`)
    }
  } else {
    console.log(`  ↩ ${existingChallenges} challenges already exist`)
  }

  // ── Issue Topics ──────────────────────────────────────────────────────────────
  const existingIssues = await db.issueTopic.count()
  if (existingIssues === 0) {
    console.log("Creating issue topics...")

    // Load resources to map as recommendations
    const pathways = await db.growthPathway.findMany({ where: { active: true } })
    const challenges = await db.challenge.findMany({ where: { active: true } })

    const pSlug = Object.fromEntries(pathways.map((p) => [p.slug, p]))
    const cSlug = Object.fromEntries(challenges.map((c) => [c.slug, c]))

    const topics = [
      {
        title: "I don't know where to start",
        slug: "dont-know-where-to-start",
        description: "Feeling stuck with no clear first step is more common than you think. Let's figure out what's actually getting in the way.",
        focusAreaId: fa["Personal Development"],
        order: 1,
        recs: [
          { type: "PATHWAY", slug: "launch-your-career", title: "Launch Your Career" },
          { type: "CHALLENGE", slug: "30-day-morning-momentum", title: "30-Day Morning Momentum Challenge" },
        ],
      },
      {
        title: "I'm struggling with motivation",
        slug: "struggling-with-motivation",
        description: "When nothing seems worth the effort, it's usually a signal — not a character flaw. Here's where to look.",
        focusAreaId: fa["Personal Development"],
        order: 2,
        recs: [
          { type: "CHALLENGE", slug: "30-day-morning-momentum", title: "30-Day Morning Momentum Challenge" },
          { type: "PATHWAY", slug: "commit-to-your-health", title: "Commit to Your Health" },
        ],
      },
      {
        title: "My finances feel out of control",
        slug: "finances-out-of-control",
        description: "Debt, spending, saving — it all piles up. The good news is clarity is one step away.",
        focusAreaId: fa["Financial Wellness"],
        order: 3,
        recs: [
          { type: "PATHWAY", slug: "build-your-financial-foundation", title: "Build Your Financial Foundation" },
          { type: "CHALLENGE", slug: "7-day-financial-check-in", title: "7-Day Financial Check-In" },
        ],
      },
      {
        title: "I want to advance my career but feel stuck",
        slug: "career-stuck",
        description: "Whether it's a plateau, a ceiling, or just uncertainty about the next move, there's usually a clear path forward.",
        focusAreaId: fa["Career & Professional Growth"],
        order: 4,
        recs: [
          { type: "PATHWAY", slug: "launch-your-career", title: "Launch Your Career" },
        ],
      },
      {
        title: "I'm not taking care of myself",
        slug: "not-taking-care-of-myself",
        description: "Health keeps falling to the bottom of the list. Let's change what's realistic before anything else.",
        focusAreaId: fa["Health & Fitness"],
        order: 5,
        recs: [
          { type: "PATHWAY", slug: "commit-to-your-health", title: "Commit to Your Health" },
          { type: "CHALLENGE", slug: "30-day-morning-momentum", title: "30-Day Morning Momentum Challenge" },
        ],
      },
      {
        title: "I feel isolated and disconnected",
        slug: "isolated-disconnected",
        description: "Meaningful relationships don't happen by accident. Here's how to rebuild them deliberately.",
        focusAreaId: fa["Relationships & Community"],
        order: 6,
        recs: [
          { type: "CHALLENGE", slug: "21-day-relationship-reset", title: "21-Day Relationship Reset" },
        ],
      },
    ]

    for (const t of topics) {
      const { recs, ...topicData } = t
      const topic = await db.issueTopic.create({ data: topicData })

      for (const [i, rec] of recs.entries()) {
        let resourceId: string | null = null
        if (rec.type === "PATHWAY" && pSlug[rec.slug]) resourceId = pSlug[rec.slug].id
        if (rec.type === "CHALLENGE" && cSlug[rec.slug]) resourceId = cSlug[rec.slug].id
        if (!resourceId) {
          console.log(`    ⚠ Skipping rec "${rec.title}" — resource not found`)
          continue
        }
        await db.issueRecommendationMap.create({
          data: {
            issueTopicId: topic.id,
            recommendationType: rec.type as "PATHWAY" | "CHALLENGE" | "RESOURCE" | "BLOG_POST",
            resourceId,
            resourceTitle: rec.title,
            priority: recs.length - i,
          },
        })
      }

      console.log(`  ✓ Issue topic: ${topic.title}`)
    }
  } else {
    console.log(`  ↩ ${existingIssues} issue topics already exist`)
  }

  console.log("\nDone. Phase 2 content is ready.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
