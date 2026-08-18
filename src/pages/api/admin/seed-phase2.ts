/**
 * One-time Phase 2 content seed endpoint.
 * POST /api/admin/seed-phase2 — SUPER_ADMIN only.
 * Idempotent: skips any section that already has data.
 * Remove this file after seeding is confirmed.
 */
import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

type SeedDb = {
  focusArea: {
    count: () => Promise<number>
    create: (a: { data: object }) => Promise<{ id: string; name: string }>
    findMany: (a?: object) => Promise<{ id: string; name: string }[]>
  }
  growthPathway: {
    count: () => Promise<number>
    create: (a: { data: object }) => Promise<{ id: string; title: string }>
  }
  pathwayStage: {
    create: (a: { data: object }) => Promise<unknown>
  }
  challenge: {
    count: () => Promise<number>
    create: (a: { data: object }) => Promise<{ id: string; title: string }>
    findMany: (a?: object) => Promise<{ id: string; title: string; slug: string }[]>
  }
  challengeStep: {
    create: (a: { data: object }) => Promise<unknown>
  }
  issueTopic: {
    count: () => Promise<number>
    create: (a: { data: object }) => Promise<{ id: string; title: string }>
  }
  issueRecommendationMap: {
    create: (a: { data: object }) => Promise<unknown>
  }
}

const db_ = db as never as SeedDb

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const session = await getServerSession(req, res, authOptions)
  if (session?.user?.adminRole !== "SUPER_ADMIN") {
    return res.status(401).json({ error: "SUPER_ADMIN required" })
  }

  const log: string[] = []

  // ── Focus Areas ──────────────────────────────────────────────────────────────
  const focusAreaCount = await db_.focusArea.count()
  let focusAreas: { id: string; name: string }[] = []
  if (focusAreaCount === 0) {
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
      names.map((name, i) => db_.focusArea.create({ data: { name, order: i, active: true } }))
    )
    log.push(`Created ${focusAreas.length} focus areas`)
  } else {
    focusAreas = await db_.focusArea.findMany({ orderBy: { order: "asc" } as object })
    log.push(`Focus areas already exist (${focusAreaCount}) — skipped`)
  }

  const fa: Record<string, string> = Object.fromEntries(focusAreas.map((f) => [f.name, f.id]))

  // ── Growth Pathways ───────────────────────────────────────────────────────────
  const pathwayCount = await db_.growthPathway.count()
  if (pathwayCount === 0) {
    const pathways = [
      {
        data: {
          title: "Launch Your Career",
          slug: "launch-your-career",
          summary: "A step-by-step path for professionals ready to level up their career trajectory.",
          description:
            "Whether you're starting out or pivoting, this pathway walks you through clarifying your goals, building your brand, and landing the opportunities you want.",
          focusAreaId: fa["Career & Professional Growth"],
          durationWeeks: 8,
          active: true,
          loyaltyPoints: 100,
        },
        stages: [
          { title: "Know where you're going", description: "Define your career goals and what success looks like for you.", order: 1, durationDays: 7 },
          { title: "Build your story", description: "Craft your professional narrative — resume, LinkedIn, and elevator pitch.", order: 2, durationDays: 10 },
          { title: "Expand your network", description: "Identify 10 people to reach out to and start real conversations.", order: 3, durationDays: 7 },
          { title: "Apply with intention", description: "Target the right roles, customize your outreach, and track your pipeline.", order: 4, durationDays: 14 },
          { title: "Prepare and show up", description: "Interview prep, offer negotiation, and making the most of day one.", order: 5, durationDays: 7 },
        ],
      },
      {
        data: {
          title: "Build Your Financial Foundation",
          slug: "build-your-financial-foundation",
          summary: "Get your money sorted — budgeting, debt, savings, and the habits that make it stick.",
          description:
            "Financial wellness isn't about being perfect — it's about building a system that works for your life. This pathway covers the fundamentals and helps you make real progress.",
          focusAreaId: fa["Financial Wellness"],
          durationWeeks: 6,
          active: true,
          loyaltyPoints: 100,
        },
        stages: [
          { title: "See where you stand", description: "Get a clear picture of your income, expenses, and net worth.", order: 1, durationDays: 5 },
          { title: "Build a budget that fits", description: "Create a realistic spending plan you can actually follow.", order: 2, durationDays: 7 },
          { title: "Attack your debt", description: "Choose a debt payoff strategy and start making real progress.", order: 3, durationDays: 10 },
          { title: "Start saving consistently", description: "Set up an emergency fund and automate your savings.", order: 4, durationDays: 10 },
          { title: "Make your money grow", description: "Introduction to investing and building long-term wealth.", order: 5, durationDays: 10 },
        ],
      },
      {
        data: {
          title: "Commit to Your Health",
          slug: "commit-to-your-health",
          summary: "Build sustainable habits around movement, nutrition, and recovery.",
          description:
            "Health isn't a destination — it's a practice. This pathway helps you create realistic routines around exercise, eating, sleep, and stress that you can keep going.",
          focusAreaId: fa["Health & Fitness"],
          durationWeeks: 6,
          active: true,
          loyaltyPoints: 100,
        },
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
      const pathway = await db_.growthPathway.create({ data: p.data })
      await Promise.all(
        p.stages.map((s) => db_.pathwayStage.create({ data: { ...s, pathwayId: pathway.id } }))
      )
    }
    log.push(`Created ${pathways.length} growth pathways`)
  } else {
    log.push(`Pathways already exist (${pathwayCount}) — skipped`)
  }

  // ── Challenges ────────────────────────────────────────────────────────────────
  const challengeCount = await db_.challenge.count()
  if (challengeCount === 0) {
    const challenges = [
      {
        data: {
          title: "30-Day Morning Momentum Challenge",
          slug: "30-day-morning-momentum",
          summary: "Build a morning routine that sets you up to win every day.",
          description:
            "Your morning is the one part of the day fully in your control. Over 30 days, you'll build a simple routine — movement, intention-setting, and one focused task — that compounds into real momentum.",
          focusAreaIds: [fa["Personal Development"], fa["Health & Fitness"]].filter(Boolean),
          durationDays: 30,
          active: true,
          startMode: "EVERGREEN",
          loyaltyPoints: 150,
        },
        steps: [
          { day: 1, title: "Wake up on time — no snooze", description: "Set one alarm. When it goes off, your feet hit the floor. That's it.", order: 1, reflectionPrompt: "How did today go?" },
          { day: 2, title: "Move for 10 minutes", description: "Walk, stretch, jump — anything for 10 minutes. It doesn't have to be intense.", order: 2, reflectionPrompt: "What movement did you choose?" },
          { day: 3, title: "Write down your one priority", description: "One priority. Not a list. The one thing that matters most today.", order: 3, reflectionPrompt: "Did you protect that priority?" },
          { day: 4, title: "Water before coffee", description: "A full glass of water before your first cup. Simple, but it works.", order: 4, reflectionPrompt: "How did your morning feel?" },
          { day: 5, title: "No phone for the first 30 minutes", description: "Your morning is yours before the world demands a piece of it.", order: 5, reflectionPrompt: "What did you do with those 30 minutes?" },
          { day: 6, title: "Do your hardest task first", description: "Your energy is highest in the morning — use it on the hard thing.", order: 6, reflectionPrompt: "What was the hard thing today?" },
          { day: 7, title: "Reflect on the week", description: "Five minutes to look back. What are you keeping? What's changing?", order: 7, reflectionPrompt: "What's your one keeper from this week?" },
        ],
      },
      {
        data: {
          title: "7-Day Financial Check-In",
          slug: "7-day-financial-check-in",
          summary: "Seven days to get honest about your money and make one real change.",
          description:
            "Most people avoid looking at their finances because it feels overwhelming. This 7-day challenge breaks it down into one simple step per day.",
          focusAreaIds: [fa["Financial Wellness"]].filter(Boolean),
          durationDays: 7,
          active: true,
          startMode: "EVERGREEN",
          loyaltyPoints: 50,
        },
        steps: [
          { day: 1, title: "List every account you have", description: "Checking, savings, credit cards, loans, retirement — write them all down with current balances.", order: 1, reflectionPrompt: "What surprised you?" },
          { day: 2, title: "Find out your total debt", description: "Add up every debt balance. Car, student loans, credit cards, everything. No judgment.", order: 2, reflectionPrompt: "How did it feel to see the number?" },
          { day: 3, title: "Track every dollar you spent last week", description: "Pull your bank and card statements. Categorize every transaction.", order: 3, reflectionPrompt: "Where did most of it go?" },
          { day: 4, title: "Calculate what you actually bring home", description: "After taxes and deductions — what actually hits your account each month?", order: 4, reflectionPrompt: "Is the number what you expected?" },
          { day: 5, title: "Identify your top 3 spending categories", description: "Food? Subscriptions? Eating out? Knowing where it goes is the first step.", order: 5, reflectionPrompt: "Which category surprised you most?" },
          { day: 6, title: "Find one subscription you can cut", description: "Look at your subscriptions. Find one you haven't used this month. Cancel it today.", order: 6, reflectionPrompt: "Did you cancel it? What held you back if not?" },
          { day: 7, title: "Set one financial goal for the next 90 days", description: "Make it specific and achievable. 'Save $500', 'Pay off X card', 'Build a $1k emergency fund'.", order: 7, reflectionPrompt: "What's your goal and why does it matter?" },
        ],
      },
      {
        data: {
          title: "21-Day Relationship Reset",
          slug: "21-day-relationship-reset",
          summary: "Invest in the relationships that matter and build new ones worth keeping.",
          description:
            "Relationships don't maintain themselves. Over 21 days, you'll reconnect with people you've let drift and deepen the relationships that matter most.",
          focusAreaIds: [fa["Relationships & Community"]].filter(Boolean),
          durationDays: 21,
          active: true,
          startMode: "EVERGREEN",
          loyaltyPoints: 100,
        },
        steps: [
          { day: 1, title: "Name your 5 most important relationships", description: "Family, friends, colleagues, mentors — who are the five you want to invest in most?", order: 1, reflectionPrompt: "Why these five?" },
          { day: 2, title: "Reach out to someone you've been meaning to call", description: "You know the name. You've thought about it. Text them right now.", order: 2, reflectionPrompt: "How did it go?" },
          { day: 3, title: "Do something kind for someone without telling anyone", description: "Something that takes real effort. Not a quick like — an action.", order: 3, reflectionPrompt: "What did you do?" },
          { day: 4, title: "Have a real conversation", description: "Ask a real question. Listen without thinking about what you'll say next.", order: 4, reflectionPrompt: "What did you learn?" },
          { day: 5, title: "Meet one new person", description: "An event, an introduction, a conversation online — make contact.", order: 5, reflectionPrompt: "What was the connection?" },
          { day: 6, title: "Express genuine appreciation to someone", description: "Not a compliment. A genuine statement of what they mean to you.", order: 6, reflectionPrompt: "How did they respond?" },
          { day: 7, title: "Reflect on the kind of friend you're being", description: "The people around you reflect who you're becoming. Are you showing up the way you want to?", order: 7, reflectionPrompt: "What's one thing you want to do differently?" },
        ],
      },
    ]
    for (const c of challenges) {
      const challenge = await db_.challenge.create({ data: c.data })
      await Promise.all(
        c.steps.map((s) => db_.challengeStep.create({ data: { ...s, challengeId: challenge.id } }))
      )
    }
    log.push(`Created ${challenges.length} challenges`)
  } else {
    log.push(`Challenges already exist (${challengeCount}) — skipped`)
  }

  // ── Issue Topics ──────────────────────────────────────────────────────────────
  const issueCount = await db_.issueTopic.count()
  if (issueCount === 0) {
    const challenges = await db_.challenge.findMany({ where: { active: true } as object })
    const pathways = (await (db as never as { growthPathway: { findMany: (a?: object) => Promise<{ id: string; slug: string }[]> } }).growthPathway.findMany({ where: { active: true } as object }))
    const cBySlug = Object.fromEntries(challenges.map((c) => [c.slug, c.id]))
    const pBySlug = Object.fromEntries(pathways.map((p) => [p.slug, p.id]))

    const topics = [
      {
        topic: { title: "I don't know where to start", slug: "dont-know-where-to-start", description: "Feeling stuck with no clear first step is more common than you think. Let's figure out what's actually in the way.", focusAreaId: fa["Personal Development"], order: 1 },
        recs: [
          { type: "PATHWAY", slug: "launch-your-career", title: "Launch Your Career" },
          { type: "CHALLENGE", slug: "30-day-morning-momentum", title: "30-Day Morning Momentum" },
        ],
      },
      {
        topic: { title: "I'm struggling with motivation", slug: "struggling-with-motivation", description: "When nothing seems worth the effort, it's usually a signal — not a character flaw.", focusAreaId: fa["Personal Development"], order: 2 },
        recs: [
          { type: "CHALLENGE", slug: "30-day-morning-momentum", title: "30-Day Morning Momentum" },
          { type: "PATHWAY", slug: "commit-to-your-health", title: "Commit to Your Health" },
        ],
      },
      {
        topic: { title: "My finances feel out of control", slug: "finances-out-of-control", description: "Debt, spending, saving — it all piles up. Clarity is one step away.", focusAreaId: fa["Financial Wellness"], order: 3 },
        recs: [
          { type: "PATHWAY", slug: "build-your-financial-foundation", title: "Build Your Financial Foundation" },
          { type: "CHALLENGE", slug: "7-day-financial-check-in", title: "7-Day Financial Check-In" },
        ],
      },
      {
        topic: { title: "I want to advance my career but feel stuck", slug: "career-stuck", description: "Whether it's a plateau, a ceiling, or uncertainty about the next move, there's usually a clear path forward.", focusAreaId: fa["Career & Professional Growth"], order: 4 },
        recs: [
          { type: "PATHWAY", slug: "launch-your-career", title: "Launch Your Career" },
        ],
      },
      {
        topic: { title: "I'm not taking care of myself", slug: "not-taking-care-of-myself", description: "Health keeps falling to the bottom of the list. Let's change what's realistic before anything else.", focusAreaId: fa["Health & Fitness"], order: 5 },
        recs: [
          { type: "PATHWAY", slug: "commit-to-your-health", title: "Commit to Your Health" },
          { type: "CHALLENGE", slug: "30-day-morning-momentum", title: "30-Day Morning Momentum" },
        ],
      },
      {
        topic: { title: "I feel isolated and disconnected", slug: "isolated-disconnected", description: "Meaningful relationships don't happen by accident. Here's how to rebuild them deliberately.", focusAreaId: fa["Relationships & Community"], order: 6 },
        recs: [
          { type: "CHALLENGE", slug: "21-day-relationship-reset", title: "21-Day Relationship Reset" },
        ],
      },
    ]

    for (const [i, t] of topics.entries()) {
      const topic = await db_.issueTopic.create({ data: { ...t.topic, active: true } })
      for (const [j, rec] of t.recs.entries()) {
        const resourceId = rec.type === "PATHWAY" ? pBySlug[rec.slug] : cBySlug[rec.slug]
        if (!resourceId) continue
        await db_.issueRecommendationMap.create({
          data: {
            issueTopicId: topic.id,
            recommendationType: rec.type,
            resourceId,
            resourceTitle: rec.title,
            priority: t.recs.length - j,
          },
        })
      }
      log.push(`Created issue topic: ${topic.title}`)
    }
  } else {
    log.push(`Issue topics already exist (${issueCount}) — skipped`)
  }

  return res.json({ ok: true, log })
}
