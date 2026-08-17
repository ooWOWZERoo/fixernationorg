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
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "Welcome to Fixer Nation, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>You just joined a community built around one idea: there are no problems in life, only issues and answers.</p>
<p>Here's what you have access to right now:</p>
<ul>
  <li><strong>Morning Boost</strong> — a short daily read to start your day focused</li>
  <li><strong>The Blog</strong> — practical articles on home, work, and community</li>
  <li><strong>The Resource Library</strong> — guides and worksheets members can actually use</li>
  <li><strong>The Community Feed</strong> — connect with other members, ask questions, share what you know</li>
</ul>
<p>Head to your dashboard to explore: <a href="https://fixernation.org/dashboard">fixernation.org/dashboard</a></p>
<p>Glad you're here.</p>
<p>— Anthony J. Placito<br>Founder, Fixer Nation</p>`,
          textBody: `Hi {{first_name}},

You just joined a community built around one idea: there are no problems in life, only issues and answers.

Here's what you have access to right now:

- Morning Boost — a short daily read to start your day focused
- The Blog — practical articles on home, work, and community
- The Resource Library — guides and worksheets members can actually use
- The Community Feed — connect with other members, ask questions, share what you know

Head to your dashboard: https://fixernation.org/dashboard

Glad you're here.

— Anthony J. Placito
Founder, Fixer Nation`,
        },
      },
      { order: 1, type: "WAIT", config: { days: 1 } },
      {
        order: 2,
        type: "SEND_EMAIL",
        config: {
          subject: "Your first move as a Fixer Nation member",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>A lot of people join a community and never get past the home page. Don't be that person.</p>
<p>Three things worth doing today:</p>
<ol>
  <li><strong>Complete your profile</strong> — add a photo, a headline, and a short bio. Other members will find you, and you'll earn 5 community points for doing it. <a href="https://fixernation.org/account/profile">Do it here.</a></li>
  <li><strong>Browse upcoming events</strong> — we run workshops, Q&amp;As, and community calls. Check what's coming up: <a href="https://fixernation.org/events">fixernation.org/events</a></li>
  <li><strong>Read today's Morning Boost</strong> — it takes about 3 minutes and it's free: <a href="https://fixernation.org/morning-boost">fixernation.org/morning-boost</a></li>
</ol>
<p>See you in there.</p>
<p>— Anthony</p>`,
          textBody: `Hi {{first_name}},

A lot of people join a community and never get past the home page. Don't be that person.

Three things worth doing today:

1. Complete your profile — add a photo, a headline, and a short bio. You'll earn 5 community points for it.
   https://fixernation.org/account/profile

2. Browse upcoming events — we run workshops, Q&As, and community calls.
   https://fixernation.org/events

3. Read today's Morning Boost — takes about 3 minutes.
   https://fixernation.org/morning-boost

See you in there.

— Anthony`,
        },
      },
      { order: 3, type: "WAIT", config: { days: 3 } },
      {
        order: 4,
        type: "SEND_EMAIL",
        config: {
          subject: "One more thing, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>The community feed is where a lot of the best conversations happen. Members ask questions, share wins, and help each other work through real problems.</p>
<p>If you haven't been in yet, now's a good time: <a href="https://fixernation.org/network">fixernation.org/network</a></p>
<p>Post something. Ask something. Even a quick introduction goes a long way.</p>
<p>Every post you make earns you 5 community points. Every comment earns you 2. It adds up.</p>
<p>See you there.</p>
<p>— Anthony</p>`,
          textBody: `Hi {{first_name}},

The community feed is where a lot of the best conversations happen. Members ask questions, share wins, and help each other work through real problems.

If you haven't been in yet, now's a good time: https://fixernation.org/network

Post something. Ask something. Even a quick introduction goes a long way.

Every post earns you 5 community points. Every comment earns you 2.

See you there.

— Anthony`,
        },
      },
    ],
  },

  loyalty_milestone: {
    name: "Loyalty milestone reward",
    description: "Celebrate members when they hit 100 points",
    trigger: "LOYALTY_MILESTONE",
    triggerConfig: { threshold: "100" },
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "You hit 100 points, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>You've earned 100 community points. That means you've been showing up — posting, commenting, RSVPing, referring people. That's exactly the kind of participation that makes this community worth being in.</p>
<p>Keep it going. The next milestone is 250 points.</p>
<p>See your full point history here: <a href="https://fixernation.org/account/points">fixernation.org/account/points</a></p>
<p>— Anthony</p>`,
          textBody: `Hi {{first_name}},

You've earned 100 community points. That means you've been showing up — posting, commenting, RSVPing, referring people. That's exactly the kind of participation that makes this community worth being in.

Keep it going. The next milestone is 250 points.

See your full point history: https://fixernation.org/account/points

— Anthony`,
        },
      },
      { order: 1, type: "ADD_TAG", config: { tag: "loyalty-milestone-100" } },
    ],
  },

  event_followup: {
    name: "Event follow-up",
    description: "Confirm and remind attendees after they RSVP",
    trigger: "EVENT_RSVP",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "You're registered, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>Your spot is confirmed. We have you down for the event and we're looking forward to seeing you there.</p>
<p>Check your event details here: <a href="https://fixernation.org/events">fixernation.org/events</a></p>
<p>If anything comes up and you can't make it, please cancel your RSVP so someone on the waitlist can take your spot.</p>
<p>See you soon.</p>
<p>— The Fixer Nation Team</p>`,
          textBody: `Hi {{first_name}},

Your spot is confirmed. We have you down for the event and we're looking forward to seeing you there.

Check your event details: https://fixernation.org/events

If anything comes up and you can't make it, please cancel your RSVP so someone on the waitlist can take your spot.

See you soon.

— The Fixer Nation Team`,
        },
      },
      { order: 1, type: "WAIT", config: { days: 1 } },
      {
        order: 2,
        type: "SEND_EMAIL",
        config: {
          subject: "Quick reminder about your upcoming event",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>Just a heads-up that your event is coming up soon.</p>
<p>If you have questions beforehand or want to connect with other attendees, the community feed is the place: <a href="https://fixernation.org/network">fixernation.org/network</a></p>
<p>Bring a notebook. Bring a question. We'll take it from there.</p>
<p>— The Fixer Nation Team</p>`,
          textBody: `Hi {{first_name}},

Just a heads-up that your event is coming up soon.

If you have questions beforehand or want to connect with other attendees, the community feed is the place: https://fixernation.org/network

Bring a notebook. Bring a question. We'll take it from there.

— The Fixer Nation Team`,
        },
      },
    ],
  },

  member_onboarding: {
    name: "New member onboarding",
    description: "4-step sequence for newly accepted members",
    trigger: "APPLICATION_ACCEPTED",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "You're in, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>Your application was reviewed and accepted. Welcome to Fixer Nation.</p>
<p>Your membership gives you full access to the community, the resource library, Morning Boost, all events, and the member directory.</p>
<p>Start here: <a href="https://fixernation.org/dashboard">fixernation.org/dashboard</a></p>
<p>If you run into anything or have questions, reply to this email. We read every one.</p>
<p>— Anthony J. Placito<br>Founder, Fixer Nation</p>`,
          textBody: `Hi {{first_name}},

Your application was reviewed and accepted. Welcome to Fixer Nation.

Your membership gives you full access to the community, the resource library, Morning Boost, all events, and the member directory.

Start here: https://fixernation.org/dashboard

If you run into anything or have questions, reply to this email. We read every one.

— Anthony J. Placito
Founder, Fixer Nation`,
        },
      },
      { order: 1, type: "WAIT", config: { days: 1 } },
      {
        order: 2,
        type: "SEND_EMAIL",
        config: {
          subject: "What's waiting for you in Fixer Nation",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>Now that you're in, here's a quick look at what's available to you as a member:</p>
<ul>
  <li><strong>Morning Boost</strong> — a short daily read. Published every morning. <a href="https://fixernation.org/morning-boost">Read today's.</a></li>
  <li><strong>Resource Library</strong> — guides, worksheets, and templates on practical topics. <a href="https://fixernation.org/resources">Browse it here.</a></li>
  <li><strong>Blog</strong> — full access to all articles. <a href="https://fixernation.org/blog">Start reading.</a></li>
  <li><strong>Events</strong> — workshops, Q&amp;As, and community calls. <a href="https://fixernation.org/events">See what's coming up.</a></li>
  <li><strong>Ask The Fixer</strong> — submit a question and get a real answer. <a href="https://fixernation.org/ask-the-fixer">Ask away.</a></li>
</ul>
<p>— Anthony</p>`,
          textBody: `Hi {{first_name}},

Now that you're in, here's a quick look at what's available:

- Morning Boost — a short daily read, published every morning.
  https://fixernation.org/morning-boost

- Resource Library — guides, worksheets, and templates.
  https://fixernation.org/resources

- Blog — full access to all articles.
  https://fixernation.org/blog

- Events — workshops, Q&As, and community calls.
  https://fixernation.org/events

- Ask The Fixer — submit a question and get a real answer.
  https://fixernation.org/ask-the-fixer

— Anthony`,
        },
      },
      { order: 3, type: "WAIT", config: { days: 3 } },
      {
        order: 4,
        type: "SEND_EMAIL",
        config: {
          subject: "Say hello, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>You've had a few days to look around. The one thing I'd encourage you to do if you haven't yet: introduce yourself in the community feed.</p>
<p>It doesn't have to be much. Your name, where you're from, what brought you here. That's enough.</p>
<p>Other members are watching the feed and they will respond. That's how this thing works.</p>
<p>Go here: <a href="https://fixernation.org/network">fixernation.org/network</a></p>
<p>— Anthony</p>`,
          textBody: `Hi {{first_name}},

You've had a few days to look around. The one thing I'd encourage you to do if you haven't yet: introduce yourself in the community feed.

It doesn't have to be much. Your name, where you're from, what brought you here. That's enough.

Other members are watching the feed and they will respond. That's how this thing works.

Go here: https://fixernation.org/network

— Anthony`,
        },
      },
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
