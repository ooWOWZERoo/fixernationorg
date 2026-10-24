import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { webpush } from "@/lib/web-push";
import { reserveBulkSendSlot, BulkBudgetExhaustedError, nextBudgetWindow } from "@/lib/mailbox-budget";
import { makeUnsubUrl } from "@/lib/unsub-token";
import type { AutomationEnrollment, AutomationStep, AutomationTrigger } from "@prisma/client";

const BASE_URL = process.env.NEXTAUTH_URL ?? "https://fixernation.org";

function substituteVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

function referencedTokens(...parts: string[]): Set<string> {
  const found = new Set<string>();
  for (const part of parts) {
    for (const m of part.matchAll(/\{\{(\w+)\}\}/g)) found.add(m[1]);
  }
  return found;
}

// Per-recipient values that have no sensible blank rendering -- if a
// template references one and it can't be resolved, the send is skipped
// rather than shipping "your trial ends on ." or a dead link.
const REQUIRED_TOKENS = ["trial_end_date", "morning_boost_url", "unsubscribe_url"] as const;

function isUniqueViolation(err: unknown): boolean {
  return err != null && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002";
}

type MembershipLookupDb = {
  userMembership: {
    findUnique: (a: unknown) => Promise<{ trialEnd: Date | null; currentPeriodEnd: Date | null } | null>;
  };
};

async function resolveContactIdForEnrollment(enrollment: AutomationEnrollment): Promise<string | null> {
  if (enrollment.contactId) return enrollment.contactId;
  if (!enrollment.userId) return null;
  const contact = await db.contact.findUnique({ where: { userId: enrollment.userId }, select: { id: true } });
  return contact?.id ?? null;
}

async function buildSendVars(
  enrollment: AutomationEnrollment,
  firstName: string | null,
  tokens: Set<string>
): Promise<Record<string, string>> {
  const vars: Record<string, string> = {
    first_name: firstName || "Fixer Nation member",
    manage_preferences_url: `${BASE_URL}/account`,
  };

  if (tokens.has("trial_end_date") && enrollment.userId) {
    const membership = await (db as never as MembershipLookupDb).userMembership.findUnique({
      where: { userId: enrollment.userId },
    });
    const end = membership?.trialEnd ?? membership?.currentPeriodEnd ?? null;
    if (end) {
      vars.trial_end_date = end.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    }
  }

  if (tokens.has("morning_boost_url")) {
    const entry = await db.morningBoost.findFirst({
      where: { publishedAt: { not: null, lte: new Date() } },
      orderBy: { publishedAt: "desc" },
      select: { slug: true },
    });
    if (entry) vars.morning_boost_url = `${BASE_URL}/morning-boost/${entry.slug}`;
  }

  if (tokens.has("unsubscribe_url")) {
    const contactId = await resolveContactIdForEnrollment(enrollment);
    if (contactId) {
      vars.unsubscribe_url = makeUnsubUrl(contactId, BASE_URL);
    } else if (enrollment.userId) {
      vars.unsubscribe_url = `${BASE_URL}/account`;
    }
  }

  return vars;
}

interface EnrollOptions {
  trigger: AutomationTrigger;
  userId?: string | null;
  contactId?: string | null;
  triggerConfig?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export async function enrollInJourneys(opts: EnrollOptions): Promise<void> {
  const { trigger, userId, contactId, triggerConfig, metadata } = opts;

  const journeys = await db.automationJourney.findMany({
    where: { trigger, active: true },
    select: { id: true, triggerConfig: true },
  });

  for (const journey of journeys) {
    if (journey.triggerConfig && triggerConfig) {
      const jc = journey.triggerConfig as Record<string, string>;
      const allMatch = Object.entries(jc).every(([k, v]) => !v || triggerConfig[k] === v);
      if (!allMatch) continue;
    }

    const alreadyActive = await db.automationEnrollment.findFirst({
      where: {
        journeyId: journey.id,
        status: "ACTIVE",
        ...(userId ? { userId } : {}),
        ...(contactId && !userId ? { contactId } : {}),
      },
    });
    if (alreadyActive) continue;

    try {
      await db.automationEnrollment.create({
        data: {
          journeyId: journey.id,
          userId: userId ?? null,
          contactId: contactId ?? null,
          nextRunAt: new Date(),
          ...(metadata !== undefined ? { metadata: metadata as Prisma.InputJsonValue } : {}),
          events: {
            create: { type: "enrolled", metadata: { trigger, ...(triggerConfig ?? {}) } },
          },
        },
      });
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        // Already enrolled by a concurrent call for the same journey+user
        // (or journey+contact) -- the partial unique index caught the race
        // that the findFirst check above could miss.
        continue;
      }
      throw err;
    }
  }
}

interface CancelOptions {
  trigger: AutomationTrigger;
  // Every key given here must equal the journey's own triggerConfig value --
  // stricter than enrollInJourneys' matching on purpose, so a generic
  // "any tag" journey is never cancelled by a tag-specific call.
  triggerConfig?: Record<string, string>;
  userId?: string | null;
  contactId?: string | null;
  reason: string;
}

// Programmatic counterpart to the admin enrollment PATCH: stops a person's
// pending ACTIVE/PAUSED enrollments in the matching journey(s). Identity is
// resolved across both keys -- a user-scoped call also reaches enrollments
// made against that user's Contact (and vice versa), which is what lets a
// contact-keyed journey be stopped from a user-keyed event like a Stripe
// subscription change.
export async function cancelActiveEnrollments(opts: CancelOptions): Promise<number> {
  const { trigger, triggerConfig, userId, contactId, reason } = opts;
  if (!userId && !contactId) return 0;

  const journeys = await db.automationJourney.findMany({
    where: { trigger },
    select: { id: true, triggerConfig: true },
  });
  const journeyIds = journeys
    .filter((j) => {
      if (!triggerConfig) return true;
      const jc = (j.triggerConfig ?? {}) as Record<string, string>;
      return Object.entries(triggerConfig).every(([k, v]) => jc[k] === v);
    })
    .map((j) => j.id);
  if (journeyIds.length === 0) return 0;

  const userIds = new Set<string>();
  const contactIds = new Set<string>();
  if (userId) {
    userIds.add(userId);
    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
    const contacts = await db.contact.findMany({
      where: { OR: [{ userId }, ...(user?.email ? [{ email: user.email }] : [])] },
      select: { id: true },
    });
    contacts.forEach((c) => contactIds.add(c.id));
  }
  if (contactId) {
    contactIds.add(contactId);
    const contact = await db.contact.findUnique({ where: { id: contactId }, select: { userId: true } });
    if (contact?.userId) userIds.add(contact.userId);
  }

  const identity = [
    ...(userIds.size ? [{ userId: { in: [...userIds] } }] : []),
    ...(contactIds.size ? [{ contactId: { in: [...contactIds] } }] : []),
  ];

  const pending = await db.automationEnrollment.findMany({
    where: { journeyId: { in: journeyIds }, status: { in: ["ACTIVE", "PAUSED"] }, OR: identity },
    select: { id: true },
  });
  if (pending.length === 0) return 0;
  const ids = pending.map((e) => e.id);

  const { count } = await db.automationEnrollment.updateMany({
    where: { id: { in: ids }, status: { in: ["ACTIVE", "PAUSED"] } },
    data: { status: "CANCELLED", nextRunAt: null },
  });
  await db.automationEvent.createMany({
    data: ids.map((enrollmentId) => ({ enrollmentId, type: "cancelled", metadata: { reason } })),
  });
  return count;
}

type StepWithConfig = AutomationStep & { config: Record<string, unknown> };

async function resolveRecipient(
  enrollment: AutomationEnrollment
): Promise<{ email: string; firstName: string | null } | null> {
  if (enrollment.contactId) {
    const contact = await db.contact.findUnique({
      where: { id: enrollment.contactId },
      select: { email: true, firstName: true },
    });
    return contact ? { email: contact.email, firstName: contact.firstName } : null;
  }
  if (enrollment.userId) {
    const user = await db.user.findUnique({
      where: { id: enrollment.userId },
      select: { email: true, name: true },
    });
    return user ? { email: user.email, firstName: user.name?.split(" ")[0] ?? null } : null;
  }
  return null;
}

async function executeStepAction(step: StepWithConfig, enrollment: AutomationEnrollment): Promise<void> {
  const config = step.config;

  switch (step.type) {
    case "SEND_EMAIL": {
      const recipient = await resolveRecipient(enrollment);
      if (!recipient) return;

      // Per-user automation email opt-out (SP: automation opt-out). Only
      // applies to userId-scoped enrollments -- contactId enrollments (e.g.
      // newsletter_signup) are governed by the separate ContactConsentTopic
      // system and are untouched here.
      if (enrollment.userId) {
        // automationsOptedOutAll / automationCategoryOptOuts (User) and
        // category (AutomationJourney) are new scalar fields not yet in the
        // locally-generated Prisma client's types (regenerates on Vercel
        // build) -- fetch full rows and cast rather than using `select` with
        // field names the current type doesn't know about.
        const [user, journey] = await Promise.all([
          db.user.findUnique({ where: { id: enrollment.userId } }),
          db.automationJourney.findUnique({ where: { id: enrollment.journeyId } }),
        ]);

        const optedOutAll = (user as unknown as { automationsOptedOutAll?: boolean } | null)?.automationsOptedOutAll ?? false;
        const categoryOptOuts = (user as unknown as { automationCategoryOptOuts?: string[] } | null)?.automationCategoryOptOuts ?? [];
        const category = (journey as unknown as { category?: string | null } | null)?.category ?? null;

        if (optedOutAll || (category && categoryOptOuts.includes(category))) {
          console.log(
            `[automation] Skipping SEND_EMAIL for enrollment ${enrollment.id} -- user opted out (all=${optedOutAll}, category=${category ?? "none"})`
          );
          return;
        }
      }

      let subject = (config.subject as string) ?? "";
      let html = (config.htmlBody as string) ?? "";
      let text = (config.textBody as string) ?? subject;

      if (config.templateId) {
        const tmpl = await db.emailTemplate.findUnique({
          where: { id: config.templateId as string },
        });
        if (tmpl) {
          subject = tmpl.subject;
          html = tmpl.htmlBody;
          text = tmpl.textBody ?? tmpl.subject;
        }
      }

      const tokens = referencedTokens(subject, html, text);
      const vars = await buildSendVars(enrollment, recipient.firstName, tokens);

      const missing = REQUIRED_TOKENS.filter((t) => tokens.has(t) && !vars[t]);
      if (missing.length > 0) {
        console.warn(
          `[automation] Skipping SEND_EMAIL for enrollment ${enrollment.id} -- unresolved required token(s): ${missing.join(", ")}`
        );
        return;
      }

      // An email that offers a one-click (CAMPAIGNS) unsubscribe link has to
      // honor it -- otherwise the link would set consent and the next step
      // in the journey would send anyway.
      if (tokens.has("unsubscribe_url")) {
        const contactId = await resolveContactIdForEnrollment(enrollment);
        if (contactId) {
          const consent = await db.contactConsent.findUnique({
            where: { contactId_topic: { contactId, topic: "CAMPAIGNS" } },
            select: { optedIn: true },
          });
          if (consent && !consent.optedIn) {
            console.log(`[automation] Skipping SEND_EMAIL for enrollment ${enrollment.id} -- contact unsubscribed (CAMPAIGNS)`);
            return;
          }
        }
      }

      subject = substituteVars(subject, vars);
      html = substituteVars(html, vars);
      text = substituteVars(text, vars);

      if (subject && html) {
        // Automation mail deliberately stays on the bulk mailbox (campaigns@)
        // because a single tick can attempt up to `take: 100` sends with no
        // batching of its own — bulk-shaped volume, so it has to spend from
        // the same metered budget campaigns do. A denial unwinds to the tick
        // loop, which defers this enrollment to the next window instead of
        // failing it.
        if (!(await reserveBulkSendSlot())) throw new BulkBudgetExhaustedError();
        await sendEmail({ to: recipient.email, subject, html, text });
      }
      break;
    }

    case "ADD_TAG": {
      if (!enrollment.contactId) return;
      const tag = config.tag as string;
      if (tag) {
        await db.contactTag.upsert({
          where: { contactId_tag: { contactId: enrollment.contactId, tag } },
          create: { contactId: enrollment.contactId, tag },
          update: {},
        });
      }
      break;
    }

    case "WEBHOOK": {
      const url = config.url as string;
      if (url) {
        await fetch(url, {
          method: (config.method as string) ?? "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enrollmentId: enrollment.id,
            journeyId: enrollment.journeyId,
            userId: enrollment.userId,
            contactId: enrollment.contactId,
          }),
          signal: AbortSignal.timeout(10000),
        });
      }
      break;
    }

    case "REMOVE_TAG": {
      if (!enrollment.contactId) return;
      const tag = config.tag as string;
      if (tag) {
        await db.contactTag.deleteMany({ where: { contactId: enrollment.contactId, tag } });
      }
      break;
    }

    case "SEND_PUSH": {
      if (!enrollment.userId) return;
      const subs = await db.pushSubscription.findMany({ where: { userId: enrollment.userId } });
      if (subs.length === 0) return;
      const payload = JSON.stringify({
        title: (config.title as string) ?? "",
        body: (config.body as string) ?? "",
        url: (config.url as string) || "/",
      });
      await Promise.allSettled(
        subs.map((sub) =>
          webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dhKey, auth: sub.authKey } },
            payload
          )
        )
      );
      break;
    }
  }
}

// ── CONDITION step evaluation ─────────────────────────────────────────────────
// Fields/operators match the fixed set the journey builder UI actually offers
// (src/components/automation/JourneyCanvas.tsx) — not a generic evaluator.

async function resolveEvalContext(
  enrollment: AutomationEnrollment
): Promise<{ role: string | null; createdAt: Date | null }> {
  let userId = enrollment.userId;
  if (!userId && enrollment.contactId) {
    const contact = await db.contact.findUnique({
      where: { id: enrollment.contactId },
      select: { userId: true },
    });
    userId = contact?.userId ?? null;
  }

  if (userId) {
    const user = await db.user.findUnique({ where: { id: userId }, select: { role: true, createdAt: true } });
    return { role: user?.role ?? null, createdAt: user?.createdAt ?? null };
  }

  if (enrollment.contactId) {
    const contact = await db.contact.findUnique({
      where: { id: enrollment.contactId },
      select: { createdAt: true },
    });
    return { role: null, createdAt: contact?.createdAt ?? null };
  }

  return { role: null, createdAt: null };
}

async function evaluateCondition(
  enrollment: AutomationEnrollment,
  config: Record<string, unknown>
): Promise<boolean> {
  const field = config.field as string;
  const operator = (config.operator as string) ?? "equals";
  const value = String(config.value ?? "");

  if (field === "tag") {
    if (!enrollment.contactId || !value) return false;
    const match = await db.contactTag.findFirst({ where: { contactId: enrollment.contactId, tag: value } });
    return operator === "not_equals" ? !match : !!match;
  }

  if (field === "userRole") {
    const { role } = await resolveEvalContext(enrollment);
    if (role === null) return false;
    return operator === "not_equals" ? role !== value : role === value;
  }

  if (field === "daysSinceSignup") {
    const { createdAt } = await resolveEvalContext(enrollment);
    if (!createdAt) return false;
    const days = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const target = parseFloat(value);
    if (Number.isNaN(target)) return false;
    switch (operator) {
      case "not_equals":    return Math.floor(days) !== Math.floor(target);
      case "greater_than":  return days > target;
      case "less_than":     return days < target;
      default:              return Math.floor(days) === Math.floor(target); // equals
    }
  }

  return false;
}

// WAIT/CONDITION/EXIT bookkeeping. A duplicate here only means another tick
// already logged this step, so it's not an error worth failing the
// enrollment over.
async function recordStepEvent(enrollmentId: string, stepOrder: number, metadata: Prisma.InputJsonValue): Promise<void> {
  try {
    await db.automationEvent.create({ data: { enrollmentId, stepOrder, type: "step_executed", metadata } });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
  }
}

export async function tickAutomations(): Promise<{
  processed: number;
  completed: number;
  failed: number;
}> {
  const now = new Date();

  const enrollments = await db.automationEnrollment.findMany({
    where: {
      status: "ACTIVE",
      OR: [{ nextRunAt: { lte: now } }, { nextRunAt: null }],
    },
    include: {
      journey: { include: { steps: { orderBy: { order: "asc" } } } },
    },
    take: 100,
  });

  let processed = 0;
  let completed = 0;
  let failed = 0;

  for (const enrollment of enrollments) {
    const steps = enrollment.journey.steps as StepWithConfig[];

    try {
      let currentStep = enrollment.currentStep;
      let nextRunAt: Date | null = null;
      let stopped = false;

      while (currentStep < steps.length) {
        const step = steps[currentStep];

        if (step.type === "WAIT") {
          const days = (step.config as { days?: number }).days ?? 1;
          // Anchored to the start of the current UTC day, not `now`:
          // automation-tick runs once a day (vercel.json), so now + N*24h
          // lands a few seconds after the tick N days out and any invocation
          // jitter would slip every wait by a whole extra day -- enough to
          // push the trial journey's day-28 reminder past the trial end.
          const dayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
          nextRunAt = new Date(dayStart + days * 24 * 60 * 60 * 1000);
          currentStep++;
          await recordStepEvent(enrollment.id, step.order, { waitDays: days });
          break;
        }

        if (step.type === "EXIT") {
          await recordStepEvent(enrollment.id, step.order, { exit: true });
          currentStep = steps.length;
          break;
        }

        if (step.type === "CONDITION") {
          const result = await evaluateCondition(enrollment, step.config);
          await recordStepEvent(enrollment.id, step.order, { conditionResult: result });
          if (result) {
            currentStep++;
            continue;
          }
          const falseNextOrder = (step.config as { falseNextOrder?: number | null }).falseNextOrder ?? null;
          if (falseNextOrder === null) {
            currentStep = steps.length;
            break;
          }
          const targetIdx = steps.findIndex((s) => s.order === falseNextOrder);
          currentStep = targetIdx === -1 ? steps.length : targetIdx;
          continue;
        }

        // Re-check status right before acting: a webhook (e.g. trial
        // conversion) may have cancelled this enrollment after the sweep
        // loaded it, and the send must not go out regardless.
        const fresh = await db.automationEnrollment.findUnique({
          where: { id: enrollment.id },
          select: { status: true },
        });
        if (fresh?.status !== "ACTIVE") {
          stopped = true;
          break;
        }

        // Claim the step before acting. The (enrollmentId, stepOrder) unique
        // index means only one tick can ever own a given step -- a second,
        // overlapping tick (or a re-run after a partial failure) sees the
        // claim and skips the action instead of sending it twice.
        let claimId: string | null = null;
        try {
          const claim = await db.automationEvent.create({
            data: { enrollmentId: enrollment.id, stepOrder: step.order, type: "step_executed" },
            select: { id: true },
          });
          claimId = claim.id;
        } catch (err) {
          if (!isUniqueViolation(err)) throw err;
        }

        if (claimId) {
          try {
            await executeStepAction(step, enrollment);
          } catch (err) {
            // Release the claim so a deferred retry (budget window) or an
            // admin re-activation can actually perform the step.
            await db.automationEvent.delete({ where: { id: claimId } }).catch(() => {});
            throw err;
          }
        }
        currentStep++;
      }

      if (stopped) {
        processed++;
        continue;
      }

      const isDone = currentStep >= steps.length && !nextRunAt;

      // Guarded on ACTIVE so a cancellation that landed mid-sweep isn't
      // overwritten back to ACTIVE/COMPLETED.
      const { count: advanced } = await db.automationEnrollment.updateMany({
        where: { id: enrollment.id, status: "ACTIVE" },
        data: {
          currentStep,
          nextRunAt: isDone ? null : nextRunAt,
          ...(isDone ? { status: "COMPLETED", completedAt: now } : {}),
        },
      });

      if (isDone && advanced > 0) {
        await db.automationEvent.create({
          data: { enrollmentId: enrollment.id, type: "completed" },
        });
        completed++;
      }

      processed++;
    } catch (err) {
      if (err instanceof BulkBudgetExhaustedError) {
        // The mailbox's hourly budget is spent, which says nothing about this
        // enrollment. Leave it ACTIVE on its current step and re-arm it for
        // the next window — marking it FAILED here would silently drop the
        // email entirely. Every enrollment behind it would hit the same wall,
        // so stop the sweep rather than churning through the rest.
        await db.automationEnrollment.update({
          where: { id: enrollment.id },
          data: { nextRunAt: nextBudgetWindow(now) },
        }).catch(() => {});
        console.warn(
          `[automation-tick] Hourly send budget exhausted — deferred enrollment ${enrollment.id} and stopped this sweep`
        );
        break;
      }
      console.error(`[automation-tick] Enrollment ${enrollment.id} failed:`, err);
      await db.automationEnrollment.update({
        where: { id: enrollment.id },
        data: { status: "FAILED" },
      });
      await db.automationEvent.create({
        data: {
          enrollmentId: enrollment.id,
          type: "failed",
          metadata: { error: String(err) },
        },
      });
      failed++;
    }
  }

  return { processed, completed, failed };
}
