import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const TEMPLATES: Record<string, {
  name: string;
  description: string;
  trigger: string;
  triggerConfig?: Record<string, string>;
  cat: string;
  steps: { order: number; type: string; config: Record<string, unknown> }[];
}> = {
  welcome: {
    name: "Welcome series",
    description: "3-email welcome sequence for new signups",
    trigger: "SIGNUP",
    cat: "lead",
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
    cat: "success",
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
    cat: "marketing",
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
    cat: "success",
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

  // ─── Ported from FNE's 55-template automation catalog (see FNO CRM spec) ───
  // Skipped entirely (not created here):
  //  - lg6 Event Registration Confirmation — duplicates the existing `event_followup` template
  //  - mk1 Monthly Newsletter Broadcast — this is what Campaign.isRecurring already covers, not a fit for AutomationJourney
  //  - cs1 Onboarding Drip (Days 1,3,7) — duplicates `member_onboarding` / `welcome`
  //  - rp1-rp5 (all 5 Reporting templates) — scheduled admin-facing digests, not per-contact enrollee journeys;
  //    belongs in a future scheduled-cron-report feature instead
  // lg1 (Welcome New Subscriber) + lg2 (Newsletter Signup Confirmation) merged into one template below (`newsletter_signup`)
  // since they're the same event under two names.

  // ── Lead generation ──────────────────────────────────────────────────────
  newsletter_signup: {
    name: "Newsletter signup welcome",
    description: "Welcome contacts who join the newsletter list specifically, separate from full membership",
    trigger: "TAG_ADDED",
    triggerConfig: { tag: "newsletter-subscriber" },
    cat: "lead",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "You're on the list, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>You just signed up for the Fixer Nation newsletter. It lands in your inbox with what we think is worth your time: new articles, upcoming events, and the occasional resource worth using.</p>
<p>If you want more than the newsletter, membership gets you the full community, the resource library, and a daily Morning Boost. Take a look here: <a href="https://fixernation.org/join">fixernation.org/join</a></p>
<p>Either way, glad to have you reading.</p>
<p>— The Fixer Nation Team</p>`,
          textBody: `Hi {{first_name}},

You just signed up for the Fixer Nation newsletter. It lands in your inbox with what we think is worth your time: new articles, upcoming events, and the occasional resource worth using.

If you want more than the newsletter, membership gets you the full community, the resource library, and a daily Morning Boost: https://fixernation.org/join

Either way, glad to have you reading.

— The Fixer Nation Team`,
        },
      },
    ],
  },

  resource_followup: {
    name: "Free resource follow-up",
    description: "Follow up after a contact downloads something from the resource library",
    // MANUAL — resources are members-only and admin-managed; there's no
    // public download endpoint to apply a "downloaded-resource" tag from,
    // so TAG_ADDED could never fire here. Revisit if resource downloads
    // ever get their own tracked event.
    trigger: "MANUAL",
    cat: "lead",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "Did the resource help, {{first_name}}?",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>You grabbed something from our resource library recently. Hope it was useful.</p>
<p>There's more where that came from: <a href="https://fixernation.org/resources">fixernation.org/resources</a></p>
<p>And if you want the full picture, not just the downloads, membership gets you a daily Morning Boost, the blog, events, and a community that's actually active. <a href="https://fixernation.org/join">Take a look.</a></p>
<p>— The Fixer Nation Team</p>`,
          textBody: `Hi {{first_name}},

You grabbed something from our resource library recently. Hope it was useful.

There's more where that came from: https://fixernation.org/resources

And if you want the full picture, not just the downloads, membership gets you a daily Morning Boost, the blog, events, and a community that's actually active: https://fixernation.org/join

— The Fixer Nation Team`,
        },
      },
    ],
  },

  // MANUAL — FNO doesn't track partial/abandoned signup sessions yet; needs a real trigger once that's built
  signup_recovery: {
    name: "Abandoned signup recovery",
    description: "Nudge someone who started signing up but never finished",
    trigger: "MANUAL",
    cat: "lead",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "Still want in, {{first_name}}?",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>Looks like you started signing up for Fixer Nation and didn't finish. It happens.</p>
<p>If something got in the way or you have a question, just reply to this email. Otherwise, pick up where you left off here: <a href="https://fixernation.org/join">fixernation.org/join</a></p>
<p>— The Fixer Nation Team</p>`,
          textBody: `Hi {{first_name}},

Looks like you started signing up for Fixer Nation and didn't finish. It happens.

If something got in the way or you have a question, just reply to this email. Otherwise, pick up where you left off: https://fixernation.org/join

— The Fixer Nation Team`,
        },
      },
    ],
  },

  // ── Membership checkout (adapted from "cart & checkout") ────────────────
  // MANUAL — FNO has no checkout-session tracking; needs a real trigger once abandoned Stripe checkouts are logged
  membership_checkout_nudge_1h: {
    name: "Membership checkout — 1 hour nudge",
    description: "Quick nudge for someone who started a membership checkout and didn't finish",
    trigger: "MANUAL",
    cat: "cart",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "You were this close, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>You started signing up for Fixer Nation membership about an hour ago and didn't finish. Your spot's still open.</p>
<p>It takes about two minutes: <a href="https://fixernation.org/join">fixernation.org/join</a></p>
<p>If something didn't work or you have a question, just reply here.</p>
<p>— The Fixer Nation Team</p>`,
          textBody: `Hi {{first_name}},

You started signing up for Fixer Nation membership about an hour ago and didn't finish. Your spot's still open.

It takes about two minutes: https://fixernation.org/join

If something didn't work or you have a question, just reply here.

— The Fixer Nation Team`,
        },
      },
    ],
  },

  // MANUAL — same checkout-tracking gap as membership_checkout_nudge_1h
  membership_checkout_followup_24h: {
    name: "Membership checkout — 24 hour follow-up",
    description: "Follow up a day after a membership checkout was left unfinished",
    trigger: "MANUAL",
    cat: "cart",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "Your Fixer Nation membership is waiting",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>Yesterday you got partway through signing up for membership. It's still there if you want to finish it.</p>
<p>Here's what you get once you're in: full access to the community, the resource library, a daily Morning Boost, and every event on the calendar.</p>
<p>Finish here: <a href="https://fixernation.org/join">fixernation.org/join</a></p>
<p>— The Fixer Nation Team</p>`,
          textBody: `Hi {{first_name}},

Yesterday you got partway through signing up for membership. It's still there if you want to finish it.

Here's what you get once you're in: full access to the community, the resource library, a daily Morning Boost, and every event on the calendar.

Finish here: https://fixernation.org/join

— The Fixer Nation Team`,
        },
      },
    ],
  },

  // MANUAL — same checkout-tracking gap
  membership_checkout_final_notice_72h: {
    name: "Membership checkout — final notice",
    description: "Last-chance nudge 72 hours after a membership checkout was left unfinished",
    trigger: "MANUAL",
    cat: "cart",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "Last call, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>This is the last note we'll send about the membership signup you started a few days ago. After this we'll assume the timing isn't right, and that's fine.</p>
<p>If you still want in, it's a couple of minutes: <a href="https://fixernation.org/join">fixernation.org/join</a></p>
<p>If a question held you up, reply and ask. We answer these ourselves.</p>
<p>— The Fixer Nation Team</p>`,
          textBody: `Hi {{first_name}},

This is the last note we'll send about the membership signup you started a few days ago. After this we'll assume the timing isn't right, and that's fine.

If you still want in, it's a couple of minutes: https://fixernation.org/join

If a question held you up, reply and ask. We answer these ourselves.

— The Fixer Nation Team`,
        },
      },
    ],
  },

  // MANUAL — needs a real "checkout started" trigger once Stripe checkout-session events are tracked
  membership_checkout_started: {
    name: "Membership checkout started",
    description: "Encourage someone who opened checkout to complete it",
    trigger: "MANUAL",
    cat: "cart",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "Finish setting up your membership",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>You opened the membership checkout page. If you're mid-decision, here's the short version of what you'd be getting: a daily Morning Boost, the full resource library, every blog post, events, and a community that answers back.</p>
<p>Pick up where you left off: <a href="https://fixernation.org/join">fixernation.org/join</a></p>
<p>— The Fixer Nation Team</p>`,
          textBody: `Hi {{first_name}},

You opened the membership checkout page. If you're mid-decision, here's the short version of what you'd be getting: a daily Morning Boost, the full resource library, every blog post, events, and a community that answers back.

Pick up where you left off: https://fixernation.org/join

— The Fixer Nation Team`,
        },
      },
    ],
  },

  // MANUAL — distinct from an existing member's renewal failing (see payment_failed_alert); needs a trigger tied to failed Stripe checkout attempts during signup
  membership_payment_failed_signup: {
    name: "Membership signup payment failed",
    description: "Recovery email when a new member's card is declined during signup",
    trigger: "MANUAL",
    cat: "cart",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "Your payment didn't go through, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>We tried to run your card for Fixer Nation membership and it didn't go through. Could be an expired card, a typo, or your bank flagging it. It happens all the time.</p>
<p>Try again here: <a href="https://fixernation.org/join">fixernation.org/join</a></p>
<p>If you keep hitting the same wall, reply to this email and we'll help you sort it out.</p>
<p>— The Fixer Nation Team</p>`,
          textBody: `Hi {{first_name}},

We tried to run your card for Fixer Nation membership and it didn't go through. Could be an expired card, a typo, or your bank flagging it. It happens all the time.

Try again here: https://fixernation.org/join

If you keep hitting the same wall, reply to this email and we'll help you sort it out.

— The Fixer Nation Team`,
        },
      },
    ],
  },

  // MANUAL — real Stripe checkout completion exists but has no automation hook today; needs a "membership purchased" trigger
  membership_signup_confirmation_upsell: {
    name: "Membership confirmation + upgrade",
    description: "Confirm a new paid membership and point toward annual/upgrade options",
    trigger: "MANUAL",
    cat: "cart",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "You're a Fixer Nation member, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>Your membership is active. Welcome in.</p>
<p>Start exploring here: <a href="https://fixernation.org/dashboard">fixernation.org/dashboard</a></p>
<p>One thing worth knowing: if you're on a monthly plan, switching to annual saves you money over the year and means one less thing to think about. Check your plan and options anytime from <a href="https://fixernation.org/account/billing">your billing page</a>.</p>
<p>— Anthony</p>`,
          textBody: `Hi {{first_name}},

Your membership is active. Welcome in.

Start exploring here: https://fixernation.org/dashboard

One thing worth knowing: if you're on a monthly plan, switching to annual saves you money over the year and means one less thing to think about. Check your plan and options anytime: https://fixernation.org/account/billing

— Anthony`,
        },
      },
    ],
  },

  // ── Book-gift redemption (the real "book purchase" signal on FNO) ─
  // Books are sold on Amazon, not through FNO checkout -- but every physical
  // copy ships with a QR code that redeems a GiftCode for a free 90-day
  // membership (src/pages/api/redeem.ts, product "free-90-day-book-gift").
  // That redemption is a real ROLE_CHANGE event, scoped with
  // triggerConfig.source="GIFT_CODE" so this only fires for gift-code
  // redemptions, not every other role change (admin edits, invite claims).
  book_gift_redeemed: {
    name: "Book gift membership redeemed",
    description: "Thank a reader for redeeming their book's free 90-day membership code, then ask for feedback a week later",
    trigger: "ROLE_CHANGE",
    triggerConfig: { source: "GIFT_CODE" },
    cat: "books",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "Your free 90 days are active, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>Thanks for picking up the book — your free 90-day Fixer Nation membership is active now.</p>
<p>Here's what that gets you: <a href="https://fixernation.org/morning-boost">Morning Boost</a>, the <a href="https://fixernation.org/resources">resource library</a>, <a href="https://fixernation.org/events">events</a>, and the <a href="https://fixernation.org/network">community feed</a>.</p>
<p>Start here: <a href="https://fixernation.org/dashboard">fixernation.org/dashboard</a></p>
<p>— Anthony J. Placito<br>Founder, Fixer Nation</p>`,
          textBody: `Hi {{first_name}},

Thanks for picking up the book — your free 90-day Fixer Nation membership is active now.

Here's what that gets you: Morning Boost (https://fixernation.org/morning-boost), the resource library (https://fixernation.org/resources), events (https://fixernation.org/events), and the community feed (https://fixernation.org/network).

Start here: https://fixernation.org/dashboard

— Anthony J. Placito
Founder, Fixer Nation`,
        },
      },
      { order: 1, type: "WAIT", config: { days: 7 } },
      {
        order: 2,
        type: "SEND_EMAIL",
        config: {
          subject: "What did you think of the book, {{first_name}}?",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>You picked up the book about a week ago. Curious what landed, what didn't, and anything you'd change.</p>
<p>Just reply to this email — we read every one and it genuinely shapes what we build next.</p>
<p>— Anthony</p>`,
          textBody: `Hi {{first_name}},

You picked up the book about a week ago. Curious what landed, what didn't, and anything you'd change.

Just reply to this email — we read every one and it genuinely shapes what we build next.

— Anthony`,
        },
      },
    ],
  },

  // MANUAL — a broadcast-style follow-up, not a single per-contact event; an admin decides when to send it to past redeemers
  book_related_recommendation: {
    name: "Related book recommendation",
    description: "Suggest another Fixer Nation book to someone who already redeemed one",
    trigger: "MANUAL",
    cat: "books",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "Since you liked that one, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>People who read that book usually end up picking up another one of ours next. Take a look: <a href="https://fixernation.org/books">fixernation.org/books</a></p>
<p>— The Fixer Nation Team</p>`,
          textBody: `Hi {{first_name}},

People who read that book usually end up picking up another one of ours next. Take a look: https://fixernation.org/books

— The Fixer Nation Team`,
        },
      },
    ],
  },

  // MANUAL — a broadcast-style announcement, not a single per-contact event; an admin decides when to send it to past redeemers
  book_new_release_announcement: {
    name: "New book release announcement",
    description: "Announce a new Fixer Nation book to past book-gift redeemers",
    trigger: "MANUAL",
    cat: "books",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "New book from Fixer Nation, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>We just published a new book. Since you've read one of ours before, figured you'd want to know first.</p>
<p><a href="https://fixernation.org/books">Check it out.</a></p>
<p>— The Fixer Nation Team</p>`,
          textBody: `Hi {{first_name}},

We just published a new book. Since you've read one of ours before, figured you'd want to know first.

Check it out: https://fixernation.org/books

— The Fixer Nation Team`,
        },
      },
    ],
  },

  // BOOK_PURCHASED — real: direct on-site book checkout (create-book-session.ts
  // + webhooks/stripe.ts). Distinct from book_gift_redeemed's ROLE_CHANGE
  // trigger, which fires separately for the free-membership welcome email.
  book_purchased: {
    name: "Book order confirmation",
    description: "Order-receipt email after a direct on-site book purchase",
    trigger: "BOOK_PURCHASED",
    cat: "books",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "Your book's on the way, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>Thanks for your order. Your book is on its way.</p>
<p>One more thing: buying direct also switched on a free 90-day Fixer Nation membership on your account. It's already active, no QR code needed.</p>
<p>Check it out here: <a href="https://fixernation.org/dashboard">fixernation.org/dashboard</a></p>
<p>— The Fixer Nation Team</p>`,
          textBody: `Hi {{first_name}},

Thanks for your order. Your book is on its way.

One more thing: buying direct also switched on a free 90-day Fixer Nation membership on your account. It's already active, no QR code needed.

Check it out here: https://fixernation.org/dashboard

— The Fixer Nation Team`,
        },
      },
    ],
  },


  // Group/seat-licensing templates (adapted from FNE's "school licenses") were
  // removed entirely -- FNO's membership model is individual, not org/seat
  // licensing, and there's no realistic path to that changing. Pure dead
  // weight, unlike the other MANUAL drafts which map to a plausible future
  // trigger.

  // ── Challenges & games (adapted from "curriculum") ───────────────────────
  // MANUAL — no "new Challenge published" trigger exists yet
  challenge_published_alert: {
    name: "New challenge published alert",
    description: "Announce a newly published Challenge",
    trigger: "MANUAL",
    cat: "curriculum",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "New challenge just went live, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>We just published a new challenge. If you're looking for your next thing to work through, this is a good one to start.</p>
<p><a href="https://fixernation.org/challenges">Check it out.</a></p>
<p>— The Fixer Nation Team</p>`,
          textBody: `Hi {{first_name}},

We just published a new challenge. If you're looking for your next thing to work through, this is a good one to start.

Check it out: https://fixernation.org/challenges

— The Fixer Nation Team`,
        },
      },
    ],
  },

  challenge_access_granted: {
    name: "Challenge access granted",
    description: "Confirm a Challenge enrollment right after a member enrolls",
    trigger: "CHALLENGE_ENROLLED",
    cat: "curriculum",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "You're enrolled, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>You're enrolled in the challenge. Your first step is waiting for you now.</p>
<p><a href="https://fixernation.org/account/challenges">Get started.</a></p>
<p>— The Fixer Nation Team</p>`,
          textBody: `Hi {{first_name}},

You're enrolled in the challenge. Your first step is waiting for you now.

Get started: https://fixernation.org/account/challenges

— The Fixer Nation Team`,
        },
      },
    ],
  },

  // MANUAL — no inactivity-on-a-challenge trigger exists yet
  challenge_incomplete_nudge_48h: {
    name: "Incomplete challenge nudge (48h)",
    description: "Nudge a member who hasn't touched their Challenge in 48 hours",
    trigger: "MANUAL",
    cat: "curriculum",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "Your challenge is waiting on you, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>It's been about two days since you touched your challenge. No judgment, life happens. Just don't let it go cold.</p>
<p><a href="https://fixernation.org/account/challenges">Pick it back up.</a></p>
<p>— The Fixer Nation Team</p>`,
          textBody: `Hi {{first_name}},

It's been about two days since you touched your challenge. No judgment, life happens. Just don't let it go cold.

Pick it back up: https://fixernation.org/account/challenges

— The Fixer Nation Team`,
        },
      },
    ],
  },

  // MANUAL — no Tune Your Brain completion trigger exists yet
  brain_game_completion_ack: {
    name: "Brain game completion acknowledgment",
    description: "Acknowledge a completed Tune Your Brain game session",
    trigger: "MANUAL",
    cat: "curriculum",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "Nice work in there, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>You just wrapped a Tune Your Brain session. Small thing, but it adds up, and you earned points for it.</p>
<p><a href="https://fixernation.org/tune-your-brain">Play another.</a></p>
<p>— The Fixer Nation Team</p>`,
          textBody: `Hi {{first_name}},

You just wrapped a Tune Your Brain session. Small thing, but it adds up, and you earned points for it.

Play another: https://fixernation.org/tune-your-brain

— The Fixer Nation Team`,
        },
      },
    ],
  },

  challenge_completed: {
    name: "Challenge completed",
    description: "Congratulate a member for finishing a Challenge, then suggest what's next a couple of days later",
    trigger: "CHALLENGE_COMPLETED",
    cat: "curriculum",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "You finished it, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>You made it through the whole challenge, start to finish. That's not nothing. You picked up loyalty points along the way too. Check your total here: <a href="https://fixernation.org/account/points">fixernation.org/account/points</a></p>
<p>Ready for the next one? <a href="https://fixernation.org/challenges">Browse what's available.</a></p>
<p>— Anthony</p>`,
          textBody: `Hi {{first_name}},

You made it through the whole challenge, start to finish. That's not nothing. You picked up loyalty points along the way too. Check your total here: https://fixernation.org/account/points

Ready for the next one? Browse what's available: https://fixernation.org/challenges

— Anthony`,
        },
      },
      { order: 1, type: "WAIT", config: { days: 2 } },
      {
        order: 2,
        type: "SEND_EMAIL",
        config: {
          subject: "What's next for you, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>Since you just finished a challenge, here's a good next one to jump into while the momentum's still there.</p>
<p><a href="https://fixernation.org/challenges">See what's available.</a></p>
<p>— The Fixer Nation Team</p>`,
          textBody: `Hi {{first_name}},

Since you just finished a challenge, here's a good next one to jump into while the momentum's still there.

See what's available: https://fixernation.org/challenges

— The Fixer Nation Team`,
        },
      },
    ],
  },

  pathway_completed: {
    name: "Growth Pathway completed",
    description: "Congratulate a member for finishing a Growth Pathway and point them to what's next",
    trigger: "PATHWAY_COMPLETED",
    cat: "success",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "You finished your Growth Pathway, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>You made it through every stage of your Growth Pathway. Pathways take real time to work through, and you stuck with yours to the end.</p>
<p>If you're up for another one, take a look: <a href="https://fixernation.org/account/pathways">fixernation.org/account/pathways</a></p>
<p>Nice work seeing this one all the way through.</p>
<p>— Anthony</p>`,
          textBody: `Hi {{first_name}},

You made it through every stage of your Growth Pathway. Pathways take real time to work through, and you stuck with yours to the end.

If you're up for another one, take a look: https://fixernation.org/account/pathways

Nice work seeing this one all the way through.

— Anthony`,
        },
      },
    ],
  },

  daily_checkin_streak: {
    name: "Daily check-in streak",
    description: "Celebrate a member's daily check-in consistency (fires at 7, 30, and 100 days)",
    trigger: "DAILY_CHECKIN_STREAK",
    cat: "success",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "You've been showing up, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>You've been checking in day after day, and that kind of steady habit is what actually moves things over time.</p>
<p>Keep it going: <a href="https://fixernation.org/account/checkin">fixernation.org/account/checkin</a></p>
<p>Glad you're sticking with it.</p>
<p>— The Fixer Nation Team</p>`,
          textBody: `Hi {{first_name}},

You've been checking in day after day, and that kind of steady habit is what actually moves things over time.

Keep it going: https://fixernation.org/account/checkin

Glad you're sticking with it.

— The Fixer Nation Team`,
        },
      },
    ],
  },

  recognition_received: {
    name: "Recognition received",
    description: "Notify a member when another member sends them recognition",
    trigger: "RECOGNITION_RECEIVED",
    cat: "success",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "Someone gave you a shout-out, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>A fellow member just sent you some recognition for something you did. Good to hear when your effort landed for someone else in this community.</p>
<p>Go see what they said: <a href="https://fixernation.org/account/recognitions">fixernation.org/account/recognitions</a></p>
<p>— The Fixer Nation Team</p>`,
          textBody: `Hi {{first_name}},

A fellow member just sent you some recognition for something you did. Good to hear when your effort landed for someone else in this community.

Go see what they said: https://fixernation.org/account/recognitions

— The Fixer Nation Team`,
        },
      },
    ],
  },

  brain_builder_milestone: {
    name: "Brain Builder milestone",
    description: "Celebrate a badge earned or a streak milestone hit in Brain Builder (Tune Your Brain)",
    trigger: "BRAIN_BUILDER_MILESTONE",
    cat: "success",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "Nice milestone in Brain Builder, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>You just hit a milestone in Brain Builder, whether that's a new badge or a streak you kept alive. Either way, it's the small stuff done over and over that adds up.</p>
<p>Keep it rolling: <a href="https://fixernation.org/tune-your-brain">fixernation.org/tune-your-brain</a></p>
<p>— The Fixer Nation Team</p>`,
          textBody: `Hi {{first_name}},

You just hit a milestone in Brain Builder, whether that's a new badge or a streak you kept alive. Either way, it's the small stuff done over and over that adds up.

Keep it rolling: https://fixernation.org/tune-your-brain

— The Fixer Nation Team`,
        },
      },
    ],
  },

  // MANUAL — no bundle/recommendation logic exists; this is a generic prompt an admin sends manually
  challenge_bundle_suggestion: {
    name: "Challenge bundle suggestion",
    description: "Suggest a few Challenges that work well back to back",
    trigger: "MANUAL",
    cat: "curriculum",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "A few challenges worth stacking, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>A few of our challenges work well back to back. If you're up for it, take a look and string a couple together.</p>
<p><a href="https://fixernation.org/challenges">Browse challenges.</a></p>
<p>— The Fixer Nation Team</p>`,
          textBody: `Hi {{first_name}},

A few of our challenges work well back to back. If you're up for it, take a look and string a couple together.

Browse challenges: https://fixernation.org/challenges

— The Fixer Nation Team`,
        },
      },
    ],
  },

  // ── Marketing ────────────────────────────────────────────────────────────
  // MANUAL — no per-contact trigger fires when a blog post publishes; an admin sends this to whoever they choose
  blog_post_notification: {
    name: "New blog post notification",
    description: "Notify a segment when a new blog post is published",
    trigger: "MANUAL",
    cat: "marketing",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "New on the blog, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>We just published something new on the blog. Worth a read when you've got a few minutes.</p>
<p><a href="https://fixernation.org/blog">Read it here.</a></p>
<p>— The Fixer Nation Team</p>`,
          textBody: `Hi {{first_name}},

We just published something new on the blog. Worth a read when you've got a few minutes.

Read it here: https://fixernation.org/blog

— The Fixer Nation Team`,
        },
      },
    ],
  },

  // MANUAL — no automated trigger for this; an admin picks the moment and the quotes
  social_proof_highlight: {
    name: "Social proof highlight",
    description: "Share member testimonials or community highlights",
    trigger: "MANUAL",
    cat: "marketing",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "What other members are saying, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>Some of the things members have been saying about Fixer Nation lately have stuck with us, and we wanted to pass a few along.</p>
<p>If it's been a while since you've been in the community feed, this is a good time to look: <a href="https://fixernation.org/network">fixernation.org/network</a></p>
<p>— The Fixer Nation Team</p>`,
          textBody: `Hi {{first_name}},

Some of the things members have been saying about Fixer Nation lately have stuck with us, and we wanted to pass a few along.

If it's been a while since you've been in the community feed, this is a good time to look: https://fixernation.org/network

— The Fixer Nation Team`,
        },
      },
    ],
  },

  // MANUAL — generic seasonal-offer shell; swap in the real promo details before sending
  seasonal_promotion: {
    name: "Seasonal promotion",
    description: "Generic seasonal offer template — edit the offer details before sending",
    trigger: "MANUAL",
    cat: "marketing",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "A limited-time offer for you, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>We're running a limited-time offer right now. [Add the specific offer details here before sending.]</p>
<p><a href="https://fixernation.org/join">See the details.</a></p>
<p>— The Fixer Nation Team</p>`,
          textBody: `Hi {{first_name}},

We're running a limited-time offer right now. [Add the specific offer details here before sending.]

See the details: https://fixernation.org/join

— The Fixer Nation Team`,
        },
      },
    ],
  },

  // MANUAL — FNO has no inactivity-tracking trigger yet
  reengagement_90d_inactive: {
    name: "Re-engagement — 90 day inactive",
    description: "Win back a member who's gone quiet",
    trigger: "MANUAL",
    cat: "marketing",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "We miss you, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>It's been a while since we've seen you around. Wanted to check in and see how you're doing.</p>
<p>A few things worth a look if you're coming back: today's Morning Boost, whatever's new on the blog, and what's happening in the community feed. <a href="https://fixernation.org/dashboard">Start here.</a></p>
<p>— Anthony</p>`,
          textBody: `Hi {{first_name}},

It's been a while since we've seen you around. Wanted to check in and see how you're doing.

A few things worth a look if you're coming back: today's Morning Boost, whatever's new on the blog, and what's happening in the community feed. Start here: https://fixernation.org/dashboard

— Anthony`,
        },
      },
    ],
  },

  // MANUAL — FNO has no stored signup-anniversary trigger yet
  anniversary_milestone_1yr: {
    name: "Milestone celebration — 1 year",
    description: "Celebrate a member's one-year anniversary",
    trigger: "MANUAL",
    cat: "marketing",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "One year in, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>You've been a Fixer Nation member for a year now. That's worth marking.</p>
<p>Thanks for sticking around and being part of this.</p>
<p>— Anthony</p>`,
          textBody: `Hi {{first_name}},

You've been a Fixer Nation member for a year now. That's worth marking.

Thanks for sticking around and being part of this.

— Anthony`,
        },
      },
    ],
  },

  // MANUAL — FNO doesn't store birthdates or track signup anniversaries yet
  birthday_message: {
    name: "Birthday / anniversary message",
    description: "Send a birthday greeting (needs a stored birthdate before this can be automated)",
    trigger: "MANUAL",
    cat: "marketing",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "Happy birthday, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>Just wanted to say happy birthday from all of us at Fixer Nation. Hope it's a good one.</p>
<p>— The Fixer Nation Team</p>`,
          textBody: `Hi {{first_name}},

Just wanted to say happy birthday from all of us at Fixer Nation. Hope it's a good one.

— The Fixer Nation Team`,
        },
      },
    ],
  },

  // ── Customer success ─────────────────────────────────────────────────────
  // MANUAL — no automated trigger; an admin names the feature before sending
  feature_spotlight: {
    name: "Product feature spotlight",
    description: "Highlight a feature members tend to miss",
    trigger: "MANUAL",
    cat: "success",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "Have you tried this yet, {{first_name}}?",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>There's a part of Fixer Nation a lot of members miss: [name the feature here]. Worth a look if you haven't used it yet.</p>
<p><a href="https://fixernation.org/dashboard">Check it out.</a></p>
<p>— The Fixer Nation Team</p>`,
          textBody: `Hi {{first_name}},

There's a part of Fixer Nation a lot of members miss: [name the feature here]. Worth a look if you haven't used it yet.

Check it out: https://fixernation.org/dashboard

— The Fixer Nation Team`,
        },
      },
    ],
  },

  // MANUAL — reframed around ContactMessage / Ask The Fixer submissions rather than a generic support ticket; no automated close-loop trigger exists yet
  support_followup: {
    name: "Support follow-up",
    description: "Follow up after a contact-form or Ask The Fixer submission is resolved",
    trigger: "MANUAL",
    cat: "success",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "Following up on your question, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>Wanted to follow up on the question you sent in. Did the answer we gave you actually solve it, or is there more we can help with?</p>
<p>Just reply to this email either way.</p>
<p>— The Fixer Nation Team</p>`,
          textBody: `Hi {{first_name}},

Wanted to follow up on the question you sent in. Did the answer we gave you actually solve it, or is there more we can help with?

Just reply to this email either way.

— The Fixer Nation Team`,
        },
      },
    ],
  },

  // MANUAL — no automated trigger; an admin decides when to send an NPS pass
  nps_survey: {
    name: "NPS survey",
    description: "Ask members how likely they are to recommend Fixer Nation",
    trigger: "MANUAL",
    cat: "success",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "One quick question, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>On a scale of 0 to 10, how likely are you to recommend Fixer Nation to a friend?</p>
<p>Just reply with a number. If you've got a sentence about why, even better, that's the part that actually helps us.</p>
<p>— Anthony</p>`,
          textBody: `Hi {{first_name}},

On a scale of 0 to 10, how likely are you to recommend Fixer Nation to a friend?

Just reply with a number. If you've got a sentence about why, even better, that's the part that actually helps us.

— Anthony`,
        },
      },
    ],
  },

  // MANUAL — no automated trigger; an admin picks the story before sending
  success_story_spotlight: {
    name: "Customer success story spotlight",
    description: "Share a member's story with the rest of the community",
    trigger: "MANUAL",
    cat: "success",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "A story worth reading, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>A fellow member recently shared what changed for them since joining. Thought you'd want to see it.</p>
<p><a href="https://fixernation.org/blog">Read the story.</a></p>
<p>— The Fixer Nation Team</p>`,
          textBody: `Hi {{first_name}},

A fellow member recently shared what changed for them since joining. Thought you'd want to see it.

Read the story: https://fixernation.org/blog

— The Fixer Nation Team`,
        },
      },
    ],
  },

  // ── Payments & ops (adapted to FNO's paid-membership subscription lifecycle) ─
  // MANUAL — no automated trigger fires on a Stripe subscription-renewal payment failure yet; content assumes that event
  payment_failed_alert: {
    name: "Payment failed alert",
    description: "Alert an existing member their subscription renewal payment failed",
    trigger: "MANUAL",
    cat: "payments",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "Your payment didn't go through, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>Your latest membership payment didn't go through. Could be an expired card or your bank flagging the charge.</p>
<p>Update your payment method here: <a href="https://fixernation.org/account/billing">fixernation.org/account/billing</a></p>
<p>We'll try again automatically, but updating your card now is the fastest way to avoid losing access.</p>
<p>— The Fixer Nation Team</p>`,
          textBody: `Hi {{first_name}},

Your latest membership payment didn't go through. Could be an expired card or your bank flagging the charge.

Update your payment method here: https://fixernation.org/account/billing

We'll try again automatically, but updating your card now is the fastest way to avoid losing access.

— The Fixer Nation Team`,
        },
      },
    ],
  },

  // MANUAL — same gap as payment_failed_alert; content assumes a retry-succeeded event
  payment_retry_success: {
    name: "Payment retry success",
    description: "Confirm a subscription payment succeeded on retry",
    trigger: "MANUAL",
    cat: "payments",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "You're all set, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>Good news, your payment went through on the retry. Your membership is current and nothing else needs your attention.</p>
<p>— The Fixer Nation Team</p>`,
          textBody: `Hi {{first_name}},

Good news, your payment went through on the retry. Your membership is current and nothing else needs your attention.

— The Fixer Nation Team`,
        },
      },
    ],
  },

  // MANUAL — no refund-issued trigger exists yet
  refund_processed_confirmation: {
    name: "Refund processed confirmation",
    description: "Confirm a refund was issued",
    trigger: "MANUAL",
    cat: "payments",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "Your refund is processed, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>Your refund has been processed. Depending on your bank, it can take a few business days to show up on your statement.</p>
<p>If you don't see it within a week, reply here and we'll look into it.</p>
<p>— The Fixer Nation Team</p>`,
          textBody: `Hi {{first_name}},

Your refund has been processed. Depending on your bank, it can take a few business days to show up on your statement.

If you don't see it within a week, reply here and we'll look into it.

— The Fixer Nation Team`,
        },
      },
    ],
  },

  // MANUAL — no invoice-paid trigger exists yet
  invoice_paid_receipt: {
    name: "Invoice paid receipt",
    description: "Send a receipt after a membership payment succeeds",
    trigger: "MANUAL",
    cat: "payments",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "Receipt for your payment, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>Here's confirmation that your membership payment went through. Find the full receipt and billing history anytime here: <a href="https://fixernation.org/account/billing">fixernation.org/account/billing</a></p>
<p>— The Fixer Nation Team</p>`,
          textBody: `Hi {{first_name}},

Here's confirmation that your membership payment went through. Find the full receipt and billing history anytime here: https://fixernation.org/account/billing

— The Fixer Nation Team`,
        },
      },
    ],
  },

  // MANUAL — FNO doesn't support pausing a subscription today; this assumes that capability exists before it's used
  subscription_paused_notification: {
    name: "Subscription paused notification",
    description: "Notify a member their membership was paused (needs a real pause feature)",
    trigger: "MANUAL",
    cat: "payments",
    steps: [
      {
        order: 0,
        type: "SEND_EMAIL",
        config: {
          subject: "Your membership is paused, {{first_name}}",
          htmlBody: `<p>Hi {{first_name}},</p>
<p>Your membership is now paused. You'll keep your history, but access to member-only areas is on hold until you resume.</p>
<p>Resume anytime from <a href="https://fixernation.org/account/billing">your account</a>.</p>
<p>— The Fixer Nation Team</p>`,
          textBody: `Hi {{first_name}},

Your membership is now paused. You'll keep your history, but access to member-only areas is on hold until you resume.

Resume anytime: https://fixernation.org/account/billing

— The Fixer Nation Team`,
        },
      },
    ],
  },

  // po6 "PO Invoice Reminder" was removed entirely — a school/district
  // purchase-order concept with no analog on an individual-membership
  // platform at all.
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

  // category is a new AutomationJourney scalar field not yet in the
  // locally-generated Prisma client types (regenerates on Vercel build).
  const createData = {
    name: template.name,
    description: template.description,
    trigger: template.trigger,
    triggerConfig: template.triggerConfig ?? undefined,
    category: template.cat,
    active: false,
    steps: {
      create: template.steps.map((s) => ({
        order: s.order,
        type: s.type,
        config: s.config,
      })),
    },
  } as never;

  const journey = await db.automationJourney.create({ data: createData });

  return res.status(201).json({ id: journey.id });
}
