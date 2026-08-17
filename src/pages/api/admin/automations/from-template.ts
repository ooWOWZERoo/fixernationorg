import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const TEMPLATES: Record<string, {
  name: string;
  description: string;
  trigger: string;
  triggerConfig?: Record<string, string>;
  steps: { order: number; type: string; config: Record<string, unknown> }[];
}> = {
  welcome: {
    name: "Welcome series",
    description: "3-email welcome sequence for new signups",
    trigger: "SIGNUP",
    steps: [
      { order: 0, type: "SEND_EMAIL", config: { subject: "Welcome to Fixer Nation!", body: "Hi {{firstName}}, welcome aboard! We're glad you're here." } },
      { order: 1, type: "WAIT", config: { days: 1 } },
      { order: 2, type: "SEND_EMAIL", config: { subject: "Getting started — your next steps", body: "Hi {{firstName}}, here's how to make the most of your membership." } },
      { order: 3, type: "WAIT", config: { days: 3 } },
      { order: 4, type: "SEND_EMAIL", config: { subject: "The community is waiting for you", body: "Hi {{firstName}}, come say hello in the community feed." } },
    ],
  },
  loyalty_milestone: {
    name: "Loyalty milestone reward",
    description: "Celebrate members when they hit 100 points",
    trigger: "LOYALTY_MILESTONE",
    triggerConfig: { threshold: "100" },
    steps: [
      { order: 0, type: "SEND_EMAIL", config: { subject: "You've hit a new milestone!", body: "Hi {{firstName}}, you've earned 100 points — thank you for being an active part of Fixer Nation." } },
      { order: 1, type: "ADD_TAG", config: { tag: "loyalty-milestone-100" } },
    ],
  },
  event_followup: {
    name: "Event follow-up",
    description: "Confirm and remind attendees after they RSVP",
    trigger: "EVENT_RSVP",
    steps: [
      { order: 0, type: "SEND_EMAIL", config: { subject: "You're registered!", body: "Hi {{firstName}}, your spot is confirmed. We'll see you there." } },
      { order: 1, type: "WAIT", config: { days: 1 } },
      { order: 2, type: "SEND_EMAIL", config: { subject: "See you soon — here's what to expect", body: "Hi {{firstName}}, just a reminder about the upcoming event." } },
    ],
  },
  member_onboarding: {
    name: "New member onboarding",
    description: "4-step sequence for newly accepted members",
    trigger: "APPLICATION_ACCEPTED",
    steps: [
      { order: 0, type: "SEND_EMAIL", config: { subject: "Your application was accepted!", body: "Hi {{firstName}}, welcome to the Fixer Nation community." } },
      { order: 1, type: "WAIT", config: { days: 1 } },
      { order: 2, type: "SEND_EMAIL", config: { subject: "Your Fixer Nation resources", body: "Hi {{firstName}}, here's a quick look at everything available to you." } },
      { order: 3, type: "WAIT", config: { days: 3 } },
      { order: 4, type: "SEND_EMAIL", config: { subject: "Meet the community", body: "Hi {{firstName}}, the Fixer Nation community is active and ready to connect." } },
    ],
  },
};

export { TEMPLATES };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { templateId } = req.body as { templateId: string };
  const template = TEMPLATES[templateId];
  if (!template) {
    return res.status(400).json({ error: "Unknown template." });
  }

  const journey = await db.automationJourney.create({
    data: {
      name: template.name,
      description: template.description,
      trigger: template.trigger as never,
      triggerConfig: template.triggerConfig ? (template.triggerConfig as never) : undefined,
      active: false,
      steps: {
        create: template.steps.map((s) => ({
          order: s.order,
          type: s.type as never,
          config: s.config as never,
        })),
      },
    },
  });

  return res.status(201).json({ id: journey.id });
}
