import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { webpush } from "@/lib/web-push";
import type { AutomationEnrollment, AutomationStep, AutomationTrigger } from "@prisma/client";

function substituteVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
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
  }
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
      const vars = { first_name: recipient.firstName ?? "" };

      let subject = (config.subject as string) ?? "";
      let html = (config.htmlBody as string) ?? "";
      let text = (config.textBody as string) ?? subject;

      if (config.templateId) {
        const tmpl = await db.emailTemplate.findUnique({
          where: { id: config.templateId as string },
        });
        if (tmpl) {
          subject = tmpl.subject;
          html = substituteVars(tmpl.htmlBody, vars);
          text = tmpl.textBody ? substituteVars(tmpl.textBody, vars) : subject;
        }
      } else {
        subject = substituteVars(subject, vars);
        html = substituteVars(html, vars);
        text = substituteVars(text, vars);
      }

      if (subject && html) {
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

      while (currentStep < steps.length) {
        const step = steps[currentStep];

        if (step.type === "WAIT") {
          const days = (step.config as { days?: number }).days ?? 1;
          nextRunAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
          currentStep++;
          await db.automationEvent.create({
            data: {
              enrollmentId: enrollment.id,
              stepOrder: step.order,
              type: "step_executed",
              metadata: { waitDays: days },
            },
          });
          break;
        }

        if (step.type === "EXIT") {
          await db.automationEvent.create({
            data: { enrollmentId: enrollment.id, stepOrder: step.order, type: "step_executed", metadata: { exit: true } },
          });
          currentStep = steps.length;
          break;
        }

        if (step.type === "CONDITION") {
          const result = await evaluateCondition(enrollment, step.config);
          await db.automationEvent.create({
            data: {
              enrollmentId: enrollment.id,
              stepOrder: step.order,
              type: "step_executed",
              metadata: { conditionResult: result },
            },
          });
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

        await executeStepAction(step, enrollment);
        await db.automationEvent.create({
          data: { enrollmentId: enrollment.id, stepOrder: step.order, type: "step_executed" },
        });
        currentStep++;
      }

      const isDone = currentStep >= steps.length && !nextRunAt;

      await db.automationEnrollment.update({
        where: { id: enrollment.id },
        data: {
          currentStep,
          nextRunAt: isDone ? null : nextRunAt,
          ...(isDone ? { status: "COMPLETED", completedAt: now } : {}),
        },
      });

      if (isDone) {
        await db.automationEvent.create({
          data: { enrollmentId: enrollment.id, type: "completed" },
        });
        completed++;
      }

      processed++;
    } catch (err) {
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
