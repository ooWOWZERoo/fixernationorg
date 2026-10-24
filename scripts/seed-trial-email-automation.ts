/**
 * SP-78 — 30-day trial email automation seed: the 15 EmailTemplate rows
 * (11 FULL_TRIAL onboarding + 4 MB_ONLY membership invitations) and the two
 * AutomationJourney rows that send them. Copy is verbatim from the
 * "30-Day Trial Email Automation" brief (v1.0, Oct 22 2026), sections 7-8.
 *
 *   npx dotenv -e .env.neon.local -- npx tsx scripts/seed-trial-email-automation.ts
 *   npx tsx scripts/seed-trial-email-automation.ts --dry-run   (no DB access)
 *
 * Idempotent: EmailTemplate.name and AutomationJourney.name have no unique
 * constraint, so each row is looked up by name first and left untouched if
 * it already exists (admin edits made after seeding are never overwritten).
 * Both journeys are created inactive -- an admin turns them on from
 * /admin/automations after the copy/footer sign-off the brief requires.
 *
 * Tokens left in the stored copy are resolved per recipient at send time by
 * src/lib/automation.ts buildSendVars(): first_name, trial_end_date,
 * morning_boost_url (latest published entry, same /morning-boost/<slug> URL
 * the daily send uses), unsubscribe_url, manage_preferences_url. Anything
 * else aborts the seed before it writes.
 *
 * Day numbering follows the brief's definition (Day 1 = the date enrollment
 * becomes active), so the first step runs on the enrollment's first tick and
 * each WAIT is the gap to the next send day.
 */
import { PrismaClient } from "@prisma/client"
import { MB_TRIAL_TAG } from "@/lib/trial-automation"
import { buildMarketingFooter } from "@/lib/campaign-email"

const DRY_RUN = process.argv.includes("--dry-run")
const SITE = "https://fixernation.org"
const BRAND_NAVY = "#0f2460"
const BRAND_ORANGE = "#E8620A"
const CATEGORY = "trial"

const ENGINE_TOKENS = new Set([
  "first_name",
  "trial_end_date",
  "morning_boost_url",
  "unsubscribe_url",
  "manage_preferences_url",
])

const URLS = {
  morningBoost: "{{morning_boost_url}}",
  membershipSignup: `${SITE}/join`,
  myPlan: `${SITE}/account/my-plan`,
  brainBuilder: `${SITE}/tune-your-brain`,
  challenges: `${SITE}/challenges`,
  reflections: `${SITE}/account/reflections`,
  progress: `${SITE}/account/progress`,
  community: `${SITE}/network`,
  billing: `${SITE}/account/billing`,
}

interface TemplateSeed {
  code: string
  title: string
  subject: string
  preheader: string
  paragraphs: string[]
  signoff: string[]
  ctaLabel: string
  ctaUrl: string
}

const GRATITUDE = ["With gratitude,", "The Fixer Nation Team"]

const FULL_TRIAL_TEMPLATES: TemplateSeed[] = [
  {
    code: "FT01",
    title: "Day 1 | Welcome to your Fixer Nation journey",
    subject: "Welcome to Fixer Nation — your 30 days begin today",
    preheader: "Your first step toward a more intentional routine.",
    paragraphs: [
      "Welcome to Fixer Nation — your online health club for your mind, body, and soul. Over the next 30 days, we’ll help you explore practical tools to start positively, set goals, build habits, and see your progress.",
      "Start small: open today’s Morning Boost, listen to the message, and choose one positive action you can carry into your day. You do not have to change everything at once.",
      "Your next 30 days are an opportunity to discover what works for you.",
      "There are no problems in life—only issues and answers.",
    ],
    signoff: GRATITUDE,
    ctaLabel: "Watch today’s Morning Boost",
    ctaUrl: URLS.morningBoost,
  },
  {
    code: "FT02",
    title: "Day 2 | Choose your focus",
    subject: "What would you most like to improve?",
    preheader: "Your Fixer Nation experience starts with what matters to you.",
    paragraphs: [
      "Confidence. Motivation. Relationships. Financial well-being. Physical wellness. Purpose. There are many good places to begin. The most important one is the area that matters to you.",
      "Visit Focus & Goals, select your main area, and add up to two more if you wish. Your selections help personalize the experience.",
      "You do not need a perfect plan today. You just need a meaningful starting point.",
    ],
    signoff: GRATITUDE,
    ctaLabel: "Set my focus",
    ctaUrl: URLS.myPlan,
  },
  {
    code: "FT03",
    title: "Day 3 | Make a plan you can act on",
    subject: "Turn your intention into your Fixer Plan",
    preheader: "One useful next step is stronger than a vague wish.",
    paragraphs: [
      "A goal gets easier to work toward when you turn it into something you can actually do. In My Fixer Plan, create a plan, add small actions, and check them off as you go.",
      "Try this today: name one meaningful goal, write one specific action, and choose when you will do it. Progress begins with a step you can repeat.",
    ],
    signoff: GRATITUDE,
    ctaLabel: "Build my Fixer Plan",
    ctaUrl: URLS.myPlan,
  },
  {
    code: "FT05",
    title: "Day 5 | Meet Brain Builder",
    subject: "Take a few minutes to exercise a positive mindset",
    preheader: "Explore quick activities inside Brain Builder.",
    paragraphs: [
      "A better day can begin with a better response. Brain Builder offers quick, interactive activities such as Positive Reframe, Gratitude Quest, Kindness Quest, Calm & Focus, Strength Spotter, and Wellness Choices.",
      "Choose one activity today and approach it with curiosity. It is not about being perfect. It is about practicing the kind of response you want to build.",
    ],
    signoff: GRATITUDE,
    ctaLabel: "Explore Brain Builder",
    ctaUrl: URLS.brainBuilder,
  },
  {
    code: "FT07",
    title: "Day 7 | Build momentum with a challenge",
    subject: "One week in — ready for a challenge?",
    preheader: "Try a focused activity that turns intention into action.",
    paragraphs: [
      "You have reached the first week of your Fixer Nation experience. That is a great time to choose one structured challenge.",
      "Explore options such as the 30-Day Morning Momentum Challenge, 7-Day Financial Check-In, or 21-Day Relationship Reset. Pick a challenge that matches what you want to improve.",
      "You can build momentum one day at a time.",
    ],
    signoff: GRATITUDE,
    ctaLabel: "Browse Fixer Challenges",
    ctaUrl: URLS.challenges,
  },
  {
    code: "FT10",
    title: "Day 10 | A few minutes for you",
    subject: "Give yourself a moment to reflect",
    preheader: "Notice what is working, what is difficult, and what matters.",
    paragraphs: [
      "Improvement is not just about doing more. Sometimes it begins with noticing more.",
      "Your private Reflections space lets you write down what you are thinking and feeling. You might record a win, a challenge, a gratitude moment, or one lesson from the day.",
      "Try this prompt: “What is one thing I have handled better in the past ten days?”",
    ],
    signoff: GRATITUDE,
    ctaLabel: "Write a reflection",
    ctaUrl: URLS.reflections,
  },
  {
    code: "FT14",
    title: "Day 14 | Take stock of your progress",
    subject: "Two weeks in: look at how far you’ve come",
    preheader: "Small steps deserve to be noticed.",
    paragraphs: [
      "You are nearly halfway through your 30-day experience. Pause to notice what you have explored so far.",
      "My Progress helps you review activity, challenges, pathways, badges, milestones, and Brain Builder progress. Not every improvement shows up as a number — but tracking your actions can make your effort easier to recognize.",
      "Ask yourself: “What is one positive action I want to continue?”",
    ],
    signoff: GRATITUDE,
    ctaLabel: "View my progress",
    ctaUrl: URLS.progress,
  },
  {
    code: "FT21",
    title: "Day 21 | Find people who value positive growth",
    subject: "You do not have to grow alone",
    preheader: "Connect through a community centered on encouragement.",
    paragraphs: [
      "Making positive changes can feel more meaningful when you connect with others who are working on themselves, too.",
      "Fixer Nation offers a community oriented toward encouragement, well-being, shared growth, and celebrating genuine effort. Explore the conversation, contribute something constructive, or recognize another member’s progress.",
      "A positive community grows one positive interaction at a time.",
    ],
    signoff: GRATITUDE,
    ctaLabel: "Explore the community",
    ctaUrl: URLS.community,
  },
  {
    code: "FT25",
    title: "Day 25 | Twenty-five days of possibility",
    subject: "Look at what you have started",
    preheader: "Your next chapter can build on the momentum you have made.",
    paragraphs: [
      "For the past few weeks, you have had the opportunity to start mornings more intentionally and explore tools for goals, habits, reflection, and connection.",
      "Take a moment today to recognize one thing you learned about yourself and one habit you would like to carry forward.",
      "You have already invested attention in your personal growth. That matters.",
    ],
    signoff: GRATITUDE,
    ctaLabel: "Review my journey",
    ctaUrl: URLS.progress,
  },
  {
    code: "FT28",
    title: "Day 28 | Keep the progress going",
    subject: "Your Fixer Nation trial is nearing its end",
    preheader: "Review your options before {{trial_end_date}}.",
    paragraphs: [
      "Your 30-day Fixer Nation trial is scheduled to end on {{trial_end_date}}. We hope it has helped you build a more intentional daily routine.",
      "If you would like to continue, review your available membership and billing options using the link below. Any price, automatic renewal, and cancellation conditions must be clearly shown before you make a decision.",
      "Whatever you decide, we are grateful that you gave Fixer Nation a place in your mornings.",
    ],
    signoff: ["The Fixer Nation Team"],
    ctaLabel: "Review membership options",
    ctaUrl: URLS.billing,
  },
  {
    code: "FT30",
    title: "Day 30 | Keep choosing what helps you grow",
    subject: "Your 30 days are complete — what comes next?",
    preheader: "Continue your Fixer Nation journey if it is right for you.",
    paragraphs: [
      "Today marks day 30 of your Fixer Nation trial. Think about the days you paused before the rush, took a small step toward a goal, or chose to put something positive into your mind.",
      "If Fixer Nation has been useful to you, we would love to welcome you as a continuing member. Visit the link below to review your options and any applicable charges before choosing.",
      "There are no problems in life—only issues and answers.",
    ],
    signoff: GRATITUDE,
    ctaLabel: "Continue my Fixer Nation journey",
    ctaUrl: URLS.billing,
  },
]

const MB_ONLY_TEMPLATES: TemplateSeed[] = [
  {
    code: "MB05",
    title: "Day 5 | Explore the club",
    subject: "Enjoying the Morning Boost? There’s more inside Fixer Nation",
    preheader: "Your daily boost is only the beginning.",
    paragraphs: [
      "We hope the Morning Boost is helping you make a little room for something positive each day.",
      "If you want to go beyond watching, the Fixer Nation health club also offers personal goals, action plans, growth pathways, challenges, private reflections, and Brain Builder activities.",
      "Explore the full 30-day membership trial whenever you are ready.",
    ],
    signoff: GRATITUDE,
    ctaLabel: "Explore Fixer Nation membership",
    ctaUrl: URLS.membershipSignup,
  },
  {
    code: "MB14",
    title: "Day 14 | Your next step",
    subject: "What could your next positive step look like?",
    preheader: "Move from morning inspiration to a personal action plan.",
    paragraphs: [
      "You have had time to experience the Morning Boost. Now imagine pairing that encouragement with a goal you have chosen for yourself.",
      "Inside Fixer Nation, you can select focus areas and create a practical Fixer Plan with small steps you can complete.",
      "Your journey is yours. If you would like more support, consider exploring full membership.",
    ],
    signoff: GRATITUDE,
    ctaLabel: "Explore Fixer Nation membership",
    ctaUrl: URLS.membershipSignup,
  },
  {
    code: "MB21",
    title: "Day 21 | Membership invitation",
    subject: "Positive mornings. Meaningful connections.",
    preheader: "A community built around growth and encouragement.",
    paragraphs: [
      "A positive message can start your day. A positive community can give you people to connect with along the way.",
      "Fixer Nation combines Morning Boost inspiration with personal growth tools and a community for people trying to become better versions of themselves.",
      "When you are ready, see what full membership includes.",
    ],
    signoff: GRATITUDE,
    ctaLabel: "Explore Fixer Nation membership",
    ctaUrl: URLS.membershipSignup,
  },
  {
    code: "MB28",
    title: "Day 28 | Last-days invitation",
    subject: "Your free Morning Boost series is almost complete",
    preheader: "Explore your options as your 30-day email trial concludes.",
    paragraphs: [
      "Your complimentary 30-day Morning Boost experience is nearly complete. Thank you for making room for positivity in your mornings.",
      "Would you like to keep exploring Fixer Nation? Review the full membership trial and its terms. You are always welcome to decide what is right for you.",
    ],
    signoff: GRATITUDE,
    ctaLabel: "Explore Fixer Nation membership",
    ctaUrl: URLS.membershipSignup,
  },
]

// [template code, WAIT days before it]. The first send has no wait: it goes
// out on Day 1, the enrollment's first automation tick.
const FULL_TRIAL_SCHEDULE: [string, number][] = [
  ["FT01", 0], ["FT02", 1], ["FT03", 1], ["FT05", 2], ["FT07", 2], ["FT10", 3],
  ["FT14", 4], ["FT21", 7], ["FT25", 4], ["FT28", 3], ["FT30", 2],
]
const MB_ONLY_SCHEDULE: [string, number][] = [
  ["MB05", 4], ["MB14", 9], ["MB21", 7], ["MB28", 7],
]

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function templateName(t: TemplateSeed): string {
  return `SP-78 ${t.code} — ${t.title}`
}

function renderTemplate(t: TemplateSeed): { subject: string; htmlBody: string; textBody: string } {
  const footer = buildMarketingFooter("{{unsubscribe_url}}", "{{manage_preferences_url}}")
  const greeting = "Good morning, {{first_name}}!"
  const p = (text: string) =>
    `<p style="margin:0 0 18px 0;font-size:16px;line-height:1.7;color:#1e293b;">${escapeHtml(text)}</p>`

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(t.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f1f5f9;opacity:0;">${escapeHtml(t.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="background-color:${BRAND_NAVY};border-radius:16px 16px 0 0;padding:24px 32px;">
              <p style="margin:0;font-size:20px;font-weight:800;color:#ffffff;line-height:1.3;">Fixer Nation</p>
              <p style="margin:4px 0 0 0;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND_ORANGE};">Positivity, Health &amp; Wellness Network</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;padding:32px 32px 8px 32px;">
              ${p(greeting)}
              ${t.paragraphs.map(p).join("\n              ")}
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;padding:8px 32px 8px 32px;">
              <a href="${t.ctaUrl}" style="display:inline-block;background-color:${BRAND_ORANGE};color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:10px;">${escapeHtml(t.ctaLabel)}</a>
              <p style="margin:14px 0 0 0;font-size:13px;line-height:1.6;color:#64748b;">If the button doesn't work, use this link: <a href="${t.ctaUrl}" style="color:${BRAND_NAVY};word-break:break-all;">${t.ctaUrl}</a></p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;padding:24px 32px 8px 32px;">
              <p style="margin:0;font-size:16px;line-height:1.7;color:#1e293b;">${t.signoff.map(escapeHtml).join("<br>")}</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;border-radius:0 0 16px 16px;padding:0 32px 24px 32px;">${footer.html}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const textBody = [
    greeting,
    ...t.paragraphs,
    `${t.ctaLabel}: ${t.ctaUrl}`,
    t.signoff.join("\n"),
  ].join("\n\n") + footer.text

  return { subject: t.subject, htmlBody, textBody }
}

function assertOnlyEngineTokens(t: TemplateSeed, parts: string[]): void {
  for (const part of parts) {
    for (const m of part.matchAll(/\{\{(\w+)\}\}/g)) {
      if (!ENGINE_TOKENS.has(m[1])) {
        throw new Error(`${t.code}: token {{${m[1]}}} is not resolved by the automation engine`)
      }
    }
  }
}

const db = new PrismaClient()

async function upsertTemplate(t: TemplateSeed, track: string): Promise<string> {
  const name = templateName(t)
  const rendered = renderTemplate(t)
  assertOnlyEngineTokens(t, [rendered.subject, rendered.htmlBody, rendered.textBody])

  if (DRY_RUN) {
    console.log(`[dry-run] template ${name}`)
    return `dry-run-${t.code}`
  }

  const existing = await db.emailTemplate.findFirst({ where: { name }, select: { id: true } })
  if (existing) {
    console.log(`  = template exists: ${name}`)
    return existing.id
  }
  const created = await db.emailTemplate.create({
    data: {
      name,
      subject: rendered.subject,
      htmlBody: rendered.htmlBody,
      textBody: rendered.textBody,
      status: "DRAFT",
      category: CATEGORY,
      tags: `sp-78,${track}`,
    },
    select: { id: true },
  })
  console.log(`  + template created: ${name}`)
  return created.id
}

interface JourneySeed {
  name: string
  description: string
  trigger: string
  triggerConfig?: Record<string, string>
  schedule: [string, number][]
}

async function seedJourney(j: JourneySeed, templateIds: Map<string, string>): Promise<void> {
  const steps: { order: number; type: "WAIT" | "SEND_EMAIL"; config: Record<string, unknown> }[] = []
  for (const [code, waitDays] of j.schedule) {
    const templateId = templateIds.get(code)
    if (!templateId) throw new Error(`${j.name}: no template for ${code}`)
    if (waitDays > 0) steps.push({ order: steps.length, type: "WAIT", config: { days: waitDays } })
    steps.push({ order: steps.length, type: "SEND_EMAIL", config: { templateId } })
  }

  const totalDays = j.schedule.reduce((sum, [, d]) => sum + d, 0)
  if (DRY_RUN) {
    console.log(`[dry-run] journey ${j.name}: ${steps.length} steps, last send on day ${totalDays + 1}`)
    return
  }

  const existing = await db.automationJourney.findFirst({ where: { name: j.name }, select: { id: true } })
  if (existing) {
    console.log(`  = journey exists (steps untouched): ${j.name}`)
    return
  }

  // TRIAL_STARTED and AutomationJourney.category are newer than some local
  // Prisma clients -- cast rather than depend on a fresh `prisma generate`.
  await db.automationJourney.create({
    data: {
      name: j.name,
      description: j.description,
      trigger: j.trigger,
      ...(j.triggerConfig ? { triggerConfig: j.triggerConfig } : {}),
      category: CATEGORY,
      active: false,
      steps: { create: steps },
    } as never,
  })
  console.log(`  + journey created (inactive): ${j.name} -- ${steps.length} steps`)
}

async function main() {
  console.log(DRY_RUN ? "SP-78 seed (dry run)" : "SP-78 seed")

  const templateIds = new Map<string, string>()
  for (const t of FULL_TRIAL_TEMPLATES) templateIds.set(t.code, await upsertTemplate(t, "full-trial"))
  for (const t of MB_ONLY_TEMPLATES) templateIds.set(t.code, await upsertTemplate(t, "mb-only"))

  await seedJourney(
    {
      name: "30-day membership trial — onboarding (FULL_TRIAL)",
      description:
        "SP-78. 11 onboarding emails on trial days 1, 2, 3, 5, 7, 10, 14, 21, 25, 28 and 30. Enrolls when a Stripe membership subscription enters TRIALING; cancelled automatically when the trial converts to paid.",
      trigger: "TRIAL_STARTED",
      schedule: FULL_TRIAL_SCHEDULE,
    },
    templateIds
  )

  await seedJourney(
    {
      name: "30-day Morning Boost trial — membership invitations (MB_ONLY)",
      description:
        "SP-78. 4 membership invitations on days 5, 14, 21 and 28 for trial.fixernation.org Morning Boost signups. Cancelled automatically when the contact starts a full trial or becomes a paid member.",
      trigger: "TAG_ADDED",
      triggerConfig: { tag: MB_TRIAL_TAG },
      schedule: MB_ONLY_SCHEDULE,
    },
    templateIds
  )

  console.log("Done.")
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
