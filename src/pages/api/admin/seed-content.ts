import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// One-time seed for initial site content.
// Idempotent — skips any category that already has published records.

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.adminRole !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const results: Record<string, number> = { blogPosts: 0, morningBoosts: 0, resources: 0 };

  // ── Blog posts ─────────────────────────────────────────────────────────────
  const existingBlogs = await db.blogPost.count({ where: { publishedAt: { not: null } } });
  if (existingBlogs === 0) {
    await db.blogPost.createMany({
      data: [
        {
          slug: "right-person-not-right-tool",
          title: "You don't need the right tool. You need the right person.",
          category: "Mindset",
          excerpt: "A $50 tool won't save a $5,000 project if you don't know what you're doing. The most important resource you have isn't in your garage.",
          body: `<p>There's a certain kind of homeowner who owns every tool but can't finish a project. The garage is full of equipment bought for jobs that never got done right. More tools keep arriving. The problems don't go away.</p>

<p>The tool isn't the issue. The issue is that tools don't make decisions. People do.</p>

<h2>What competence actually looks like</h2>

<p>When you hire someone to fix a problem, you're not buying their equipment. You're buying their judgment — when to cut, when to wait, what to check first, what the failure mode looks like if they get it wrong. That judgment is expensive because it takes years to build and can't be downloaded.</p>

<p>A skilled plumber with a pipe wrench will outperform an amateur with a full tool set every time. Not because of the wrench. Because of the 10,000 hours behind the person holding it.</p>

<h2>When to hire instead of DIY</h2>

<p>The question isn't whether you're capable. It's whether you can afford to be wrong. Some jobs have a low cost of failure — paint the wrong color and you repaint. Other jobs have a catastrophic cost of failure — wire something incorrectly and you get a fire, flood, or injury.</p>

<p>Before you start a project yourself, ask: what happens if I get this wrong? If the answer is "a lot," find someone who does this for a living.</p>

<h2>How to find that person</h2>

<p>The Fixer Nation provider directory lists vetted service professionals across multiple trades. They've applied, been reviewed, and agreed to represent what this community stands for. Start there: <a href="/providers">fixernation.org/providers</a></p>

<p>Knowing who to call is its own skill. Build that list before you need it.</p>`,
          authorName: "Anthony J. Placito",
          publishedAt: daysAgo(14),
        },
        {
          slug: "how-to-talk-to-a-contractor",
          title: "How to talk to a contractor without getting taken advantage of",
          category: "Practical Advice",
          excerpt: "The difference between a good project experience and a nightmare often comes down to the first conversation.",
          body: `<p>Most people don't know how to hire a contractor. Not because they're not smart — because nobody teaches this. You learn by getting burned, or by learning from someone who did.</p>

<p>Here's what the first conversation should include.</p>

<h2>Ask for a written estimate</h2>

<p>Not a ballpark. Not "around this much." A written estimate with line items: labor, materials, timeline, and what's excluded. A contractor who won't put it in writing is telling you something.</p>

<p>Two or three estimates on the same job will also teach you a lot about what the job actually costs. Outliers in either direction — suspiciously cheap or unexpectedly expensive — deserve a follow-up question.</p>

<h2>Check for license and insurance before anything else</h2>

<p>In most states this is public record. A licensed contractor has agreed to meet a minimum standard of competence and can be held accountable through a licensing board. Insurance protects you if something goes wrong on your property.</p>

<p>Ask: "Are you licensed in this state? Can I get a copy of your insurance certificate?" A legitimate contractor will say yes without hesitation.</p>

<h2>Ask who actually does the work</h2>

<p>Some contractors sell the job and subcontract the work. That's not automatically bad, but you should know. Ask: "Will you be on-site during the job, or will you be sending a crew?" Know what you're getting.</p>

<h2>Get a payment schedule in writing</h2>

<p>Never pay the full amount upfront. A reasonable structure for most jobs: a deposit to start, a progress payment at a defined milestone, and the balance on completion. If a contractor asks for full payment before work begins, walk away.</p>

<h2>The questions list</h2>

<p>Download the Fixer Nation contractor hiring checklist in the resource library. It covers the questions worth asking before you sign anything: <a href="/resources">fixernation.org/resources</a></p>`,
          authorName: "Anthony J. Placito",
          publishedAt: daysAgo(7),
        },
        {
          slug: "the-five-minute-home-inspection",
          title: "The 5-minute inspection that saves you thousands",
          category: "Practical Advice",
          excerpt: "Most homeowners find problems after they become expensive. A simple routine can catch the ones that are easy to fix now and painful to fix later.",
          body: `<p>The most expensive home repair you'll ever pay for is the one that could have been caught six months earlier.</p>

<p>Water damage discovered after the drywall is ruined. A roof leak found after the insulation is soaked. A small crack in the foundation that became a large one. These aren't surprises — they're the result of skipping the walk-around.</p>

<h2>The 5-minute monthly walk</h2>

<p>You don't need a checklist. You need eyes and five minutes. Walk the perimeter of your home, look up at the roofline, look down at the foundation, check the gutters for obvious blockages, and note anything that looks different from last month.</p>

<p>Inside: check under every sink (water stains mean a slow leak), look at the ceiling in any room below a bathroom, and open the access panel to your water heater if you have one.</p>

<p>That's it. Five minutes, once a month. Most problems show up as something small before they become something big.</p>

<h2>The seasonal check</h2>

<p>Twice a year — spring and fall — go a layer deeper:</p>

<ul>
  <li>Test smoke and carbon monoxide detectors</li>
  <li>Check caulk around windows and doors</li>
  <li>Flush the water heater if you haven't in a year</li>
  <li>Clean the dryer vent (this causes house fires)</li>
  <li>Inspect the attic for signs of moisture or pests</li>
</ul>

<p>The full annual maintenance checklist is in the Fixer Nation resource library: <a href="/resources">fixernation.org/resources</a></p>

<h2>When you find something</h2>

<p>The right time to call a professional is before a small problem becomes a big one. If you're not sure what you're looking at, take a photo and ask in the community feed. Someone there has seen it before.</p>`,
          authorName: "Anthony J. Placito",
          publishedAt: daysAgo(2),
        },
      ],
    });
    results.blogPosts = 3;
  }

  // ── Morning Boost entries ──────────────────────────────────────────────────
  const existingBoosts = await db.morningBoost.count({ where: { publishedAt: { not: null } } });
  if (existingBoosts === 0) {
    await db.morningBoost.createMany({
      data: [
        {
          slug: "start-with-the-one-thing",
          title: "Start with the one thing",
          excerpt: "Not the easiest thing. Not the thing someone asked you for. The thing that actually moves the needle.",
          body: `<p>Every morning you wake up with a list. Some of it was written down. Most of it is just there, in your head, competing for attention.</p>

<p>Here's a question worth asking before you check your phone, before you answer an email, before you do anything else:</p>

<p><em>What's the one thing that would make today count, regardless of everything else?</em></p>

<p>Not the easiest thing. Not the thing that will make someone else happy fastest. The thing that actually moves something forward.</p>

<p>Do that first. The rest of the list will find its way.</p>`,
          authorName: "Anthony J. Placito",
          publishedAt: daysAgo(1),
        },
        {
          slug: "the-problem-youre-avoiding",
          title: "The problem you're avoiding is usually the problem",
          excerpt: "There's a version of this that never gets resolved. The version where you keep circling it instead of sitting down with it.",
          body: `<p>You already know what it is. You've known for a while.</p>

<p>The conversation you haven't had. The project you keep pushing back. The decision that's been sitting in a drawer because making it feels harder than not making it.</p>

<p>Here's the thing about avoidance: it's not free. Every day you don't deal with the thing, you carry it. It takes up space. It makes other work feel heavier than it needs to be.</p>

<p>Today, pick one thing you've been avoiding. Not all of them — just one. Take one step toward it. Make the call. Send the email. Open the file.</p>

<p>You don't have to finish it. Just start.</p>`,
          authorName: "Anthony J. Placito",
          publishedAt: daysAgo(2),
        },
        {
          slug: "every-person-you-help",
          title: "Every person you help is practice for the next one",
          excerpt: "The help you give today makes you better at helping tomorrow. Community isn't charity — it's a skill you build.",
          body: `<p>The members who get the most out of Fixer Nation aren't the ones who show up with questions. They're the ones who show up with answers, too.</p>

<p>When you help someone fix something — a leaky faucet, a bad contract, a hard conversation with a neighbor — you're not just solving their problem. You're sharpening your own ability to see problems clearly and respond to them usefully.</p>

<p>Community isn't about being selfless. It's about the fact that helping other people makes you better at what you do.</p>

<p>If you know something that someone else needs, share it. The community feed is right here: <a href="/network">fixernation.org/network</a></p>`,
          authorName: "Anthony J. Placito",
          publishedAt: daysAgo(3),
        },
        {
          slug: "done-right-beats-done-fast",
          title: "Done right beats done fast",
          excerpt: "Speed feels like progress. But a job done fast and wrong is just a job you'll have to do again.",
          body: `<p>There's pressure to move quickly. There always is. The client wants it done. The schedule is tight. The weather is changing. The budget is almost gone.</p>

<p>But a job done fast and wrong is not a job done. It's a job you'll have to do again, usually at a higher cost and under worse conditions.</p>

<p>The standard worth holding — for yourself and for anyone you hire — is this: did you do it the way you'd want it done if it were your own home? Your own project? Your own reputation on the line?</p>

<p>Speed matters. Cutting corners doesn't.</p>

<p>Those are different things. Keep them separate.</p>`,
          authorName: "Anthony J. Placito",
          publishedAt: daysAgo(4),
        },
        {
          slug: "you-know-more-than-you-think",
          title: "You know more than you think you do",
          excerpt: "The experience you've built is real, even when it doesn't feel like enough.",
          body: `<p>Competence is strange. The more you know, the more clearly you can see what you don't know. That can make experience feel like uncertainty rather than confidence.</p>

<p>But here's what's also true: you've solved problems before. You've figured things out. You've been in situations where you didn't know what to do and you found a way through anyway.</p>

<p>That track record is yours. It doesn't disappear when a new problem shows up.</p>

<p>Today, before you decide something is too hard or too complicated or outside your ability — remember what you've already handled. You've been right before. You'll be right again.</p>

<p>Trust what you've built.</p>`,
          authorName: "Anthony J. Placito",
          publishedAt: daysAgo(5),
        },
      ],
    });
    results.morningBoosts = 5;
  }

  // ── Resources ──────────────────────────────────────────────────────────────
  const existingResources = await db.resource.count({ where: { publishedAt: { not: null } } });
  if (existingResources === 0) {
    await db.resource.createMany({
      data: [
        {
          slug: "contractor-hiring-checklist",
          title: "Before You Hire Anyone: 10 Questions to Ask",
          type: "Worksheet",
          excerpt: "A short checklist for the first conversation with any contractor. Covers license, insurance, estimates, subcontractors, and payment terms.",
          body: `<p>Use this before you agree to anything. Print it out, pull it up on your phone, or just work through it from memory.</p>

<h2>The 10 questions</h2>

<ol>
  <li><strong>Are you licensed in this state?</strong> Ask for their license number. You can verify it online through your state's contractor licensing board.</li>
  <li><strong>Are you insured?</strong> Ask for a certificate of insurance showing general liability and workers' comp. Don't just take their word for it.</li>
  <li><strong>Can I see references from similar jobs?</strong> Recent references are more useful than old ones. A good contractor has people you can call.</li>
  <li><strong>Will you give me a written estimate?</strong> Line items, not a ballpark. Labor and materials should be listed separately.</li>
  <li><strong>What's excluded from this estimate?</strong> Surprises usually come from what wasn't said. Ask what's not included before work starts.</li>
  <li><strong>Who will actually be doing the work?</strong> Will you be on-site, or will a crew be sent? If subcontractors are involved, who are they?</li>
  <li><strong>What's the payment schedule?</strong> A deposit to start is normal. Full payment before the job is done is not.</li>
  <li><strong>What permits are needed, and who pulls them?</strong> Permits protect you, not just the contractor. Make sure someone is responsible for getting them.</li>
  <li><strong>How do you handle changes to the scope?</strong> Change orders should be written and agreed to before extra work begins.</li>
  <li><strong>What does the cleanup look like?</strong> Who's responsible for hauling materials, protecting your property during the job, and leaving the site clean?</li>
</ol>

<h2>Red flags</h2>

<ul>
  <li>Asks for full payment upfront</li>
  <li>Won't provide a written estimate</li>
  <li>Can't produce proof of license or insurance on request</li>
  <li>Pressures you to decide immediately</li>
  <li>No physical business address or verifiable online presence</li>
</ul>

<p>If something feels off in the first conversation, trust that. There are good contractors out there. You don't have to settle for one who raises questions.</p>`,
          authorName: "Anthony J. Placito",
          publishedAt: daysAgo(10),
        },
        {
          slug: "annual-home-maintenance-checklist",
          title: "Annual Home Maintenance Checklist",
          type: "Guide",
          excerpt: "A seasonal breakdown of the maintenance tasks that keep a home running and prevent the expensive repairs that come from neglect.",
          body: `<p>Most homeowners handle repairs. Fewer do maintenance. The difference shows up in the repair bill.</p>

<p>This checklist covers what to check and when. It's not exhaustive — your home has specific needs depending on age, climate, and construction — but it covers the things that cause the most expensive problems when ignored.</p>

<h2>Spring (March–May)</h2>
<ul>
  <li>Inspect the roof after winter — look for missing shingles, lifted flashing, or granule loss in gutters</li>
  <li>Clean gutters and downspouts; confirm water flows away from the foundation</li>
  <li>Check exterior caulk around windows, doors, and where different materials meet</li>
  <li>Test outdoor faucets and irrigation systems after freeze risk has passed</li>
  <li>Inspect the foundation for new cracks or moisture</li>
  <li>Service the HVAC before cooling season — replace filter, clean the condenser coils</li>
  <li>Check the dryer vent for lint buildup (this causes fires)</li>
</ul>

<h2>Summer (June–August)</h2>
<ul>
  <li>Check the attic for signs of moisture, pests, or inadequate ventilation</li>
  <li>Inspect decks and outdoor structures for rot, loose boards, and fastener corrosion</li>
  <li>Look for signs of pest activity — mud tubes, wood damage, droppings</li>
  <li>Clean and inspect the range hood and bathroom exhaust fans</li>
</ul>

<h2>Fall (September–November)</h2>
<ul>
  <li>Have the heating system serviced before you need it</li>
  <li>Clean the chimney if you use a fireplace or wood stove</li>
  <li>Drain and store outdoor hoses; shut off exterior faucet supply valves</li>
  <li>Check weather stripping on exterior doors</li>
  <li>Clean gutters again after leaves fall</li>
  <li>Test smoke and carbon monoxide detectors; replace batteries</li>
</ul>

<h2>Winter (December–February)</h2>
<ul>
  <li>Know where your main water shutoff is — you will need it someday</li>
  <li>Check pipes in unheated spaces (crawl space, garage, exterior walls) for freeze risk</li>
  <li>Check the water heater anode rod if the unit is more than 5 years old</li>
  <li>Look for ice dams forming at the roof edge after heavy snow</li>
</ul>

<h2>Year-round</h2>
<ul>
  <li>Replace HVAC filter every 1–3 months depending on system and household</li>
  <li>Test GFCI outlets monthly (the test button should interrupt power; reset should restore it)</li>
  <li>Check under sinks quarterly for slow leaks — most water damage starts small</li>
</ul>`,
          authorName: "Anthony J. Placito",
          publishedAt: daysAgo(8),
        },
        {
          slug: "reading-a-project-estimate",
          title: "Reading a Project Estimate: What to Look For",
          type: "Guide",
          excerpt: "An estimate is a document. Most people sign it without reading it closely. Here's what to actually look at before you say yes.",
          body: `<p>Contractors submit estimates. Homeowners compare prices. The number at the bottom gets most of the attention. That's backwards.</p>

<p>The number at the bottom is the result of everything above it. If you want to know whether an estimate is fair, you have to understand what's in it.</p>

<h2>What a good estimate includes</h2>

<p><strong>Scope of work</strong> — a description specific enough that you could hand it to a different contractor and get a comparable bid. "Paint the interior" is not a scope. "Prime and paint all interior walls and ceilings, two coats, including prep and protection of floors and trim" is a scope.</p>

<p><strong>Line items</strong> — labor and materials listed separately. This matters when something changes. If you see a line you don't recognize, ask what it is. A contractor who can't explain a line item on their own estimate is a concern.</p>

<p><strong>What's excluded</strong> — this section is often missing, and that's where surprises come from. Ask the contractor to tell you what's not included. Common exclusions: permits, debris removal, repair of damage found after demo begins, painting after drywall repair.</p>

<p><strong>Timeline</strong> — a start date, a completion estimate, and what could affect either. Weather, permit lead times, and material availability are legitimate variables. "When I have time" is not.</p>

<p><strong>Payment terms</strong> — how much is due at signing, what milestone triggers the next payment, and when the balance is due. The balance should be due on completion, not before.</p>

<h2>Comparing estimates</h2>

<p>Two estimates that look different in price are often different in scope. Before assuming the cheaper one is a better deal, compare what each one includes. A $2,000 difference may be explained by one contractor including permits and the other not mentioning them.</p>

<p>When scopes don't match, ask both contractors to re-bid to the same scope. That's the only way to compare honestly.</p>

<h2>What to ask before signing</h2>

<ul>
  <li>What happens if you find something unexpected once work starts?</li>
  <li>How are change orders handled? Will I approve them in writing before you proceed?</li>
  <li>What is your policy if the job runs over the estimated timeline?</li>
</ul>

<p>A contractor who resists answering these questions is telling you something. A good one will answer them directly.</p>`,
          authorName: "Anthony J. Placito",
          publishedAt: daysAgo(6),
        },
      ],
    });
    results.resources = 3;
  }

  return res.json({ ok: true, created: results });
}
