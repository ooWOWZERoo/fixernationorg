import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
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
