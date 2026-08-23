# Fixer Nation (fixernation.org) — Feature & Function Inventory

**This is a living document.** Update it whenever a sprint ships a new user-facing feature, admin capability, or system function — a short addition under the right section is enough; it doesn't need to wait for a dedicated "docs sprint." Treat it the same way `docs/FNO_Testing_Reconciliation.md` is treated: kept current as part of normal delivery, not as a separate project.

**Last updated:** 2026-08-23, reflecting commit `0bc92bb`.

---

## How to read this

The app has two faces: the public/member-facing site (sections 1–6) and the admin backend at `/admin` (section 7). Section 8 covers system-level capabilities that don't show up as a page but power several features at once (email, automation, rate limiting, etc.). Section 9 is a plain-English map of the database. Section 10 tracks small known gaps found while building this document, so they don't get lost.

---

## 1. Public-Facing Site (no sign-in required)

### 1.1 Marketing & static pages
- **Home (`/`)** — hero, benefits, content grid linking to Books/Blog/Community/Morning Boost/Providers/Ask The Fixer, testimonial, newsletter signup.
- **About (`/about`)** — founder bio, book showcase, join CTA.
- **Books (`/books`)** — book catalog with filter chips (All / Short Story Series / New Arrivals).
- **Contact (`/contact`)** — contact form (name, email, subject, message) with honeypot spam protection.
- **Legal** — Privacy (`/privacy`), Terms (`/terms`), Cookie Policy (`/cookie-policy`).
- **Sitemap (`/sitemap.xml`)** — auto-generated, excludes gated/functional pages.

### 1.2 Member-gated content
All three use the same pattern: a preview is public, the rest is blurred with a "Join Fixer Nation" gate for non-members.
- **Blog (`/blog`, `/blog/[slug]`)** — featured/most-recent post public; category filter chips; older posts gated.
- **Morning Boost (`/morning-boost`, `/morning-boost/[slug]`)** — today's entry public; archive gated. Entries support image or video (with poster image, download-blocked controls).
- **Resources Library (`/resources`, `/resources/[slug]`)** — guides/worksheets/tools/templates/videos; fully member-gated (detail pages redirect non-members to `/join`).

### 1.3 Growth content (browsable by anyone, tracking requires sign-in)
- **Challenges (`/challenges`, `/challenges/[slug]`)** — day-by-day programs; enroll requires sign-in.
- **Pathways (`/pathways`, `/pathways/[slug]`)** — multi-stage guided programs (stages can be a Morning Boost entry, blog post, resource, challenge, action prompt, group, book, or event).
- **Issues (`/issues`, `/issues/[slug]`)** — "what's going on?" topic browser mapping life situations to recommended content; signed-in members can log and resolve an issue.
- **Events (`/events`, `/events/[slug]`)** — upcoming/past events with RSVP (register / waitlist / cancel), capacity tracking, free vs. paid.
- **Ask The Fixer (`/ask-the-fixer`)** — public Q&A submission form; no membership gate today (see §10).

### 1.4 Provider & Ambassador program — marketing and applications
- **Service Provider landing (`/service-provider`)** and **Become a Provider (`/become-a-provider`)** — 6-step application wizard (contact → business → services → story → online presence → review/sign) with autosaved drafts, blocked from resubmitting too soon after a decline.
- **Brand Ambassador landing (`/brand-ambassador`)** and **Become an Ambassador (`/become-an-ambassador`)** — same 6-step pattern (contact → background → community reach → motivation → online presence → review/sign).
- **Application confirmation (`/apply/confirmed`)** — post-submit screen, also surfaces email-verification result.
- **Account invite claim (`/invite/[token]`)** — lets an accepted applicant without a user account set a password and activate.

### 1.5 Public profiles & directories
- **Provider directory (`/providers`)** — searchable/filterable by name, specialty, location, category.
- **Ambassador directory (`/ambassadors`)** — searchable by name/territory.
- **Public profile (`/profile/[username]`)** — avatar, headline, bio, member-since, plus a Provider business card or Ambassador territory card where applicable; "Message" button for signed-in visitors.

---

## 2. Authentication & Account Access

- **Sign up (`/register`)** — email verification required before sign-in.
- **Sign in (`/signin`)** — credentials + optional TOTP two-factor step.
- **Password recovery (`/forgot-password`, `/reset-password`)** — token-based reset flow.
- **Two-factor authentication (`/account/security`)** — enable (QR + manual secret → verify code) / disable (re-confirm code) TOTP.
- **Gift code redemption (`/redeem`)** — redeems an admin-issued code that grants a role (Member/Provider/Ambassador).
- **Membership checkout (`/join`)** — Free-with-Book vs. paid Consumer Membership (monthly/annual), Stripe Checkout.

---

## 3. Member Dashboard & Personal Growth

- **Dashboard (`/dashboard`)** — landing page after sign-in: membership badge, pending-application status, community points, feature tiles, and role-specific panels (Provider shortcuts; Ambassador referral/commission summary).
- **My Home (`/account/home`)** — daily personalized recommendation (act on it / save for later / not for me) with a "get a different suggestion" refresh.
- **My Fixer Plan (`/account/my-plan`)** — one active ordered plan of items (content, action, pathway, challenge, group, provider, book, event); up to 5 past plans kept.
- **My Pathways (`/account/pathways`)** — active/paused/completed pathway enrollments with progress %, continue/unenroll actions.
- **My Challenges (`/account/challenges`)** — same pattern for challenge enrollments, with a loyalty-points-on-completion callout.
- **Daily Check-In (`/account/checkin`)** — mood + energy + note, once per day, with a streak counter and 7-day history strip.
- **My Reflections (`/account/reflections`)** — private journal entries with mood and tags.
- **My Progress (`/account/progress`)** — points total, milestones, streaks, active enrollments, recognitions received; includes a peer "shout-out" form.
- **Community Points (`/account/points`)** — full points ledger with earn-reasons.
- **Focus & Goals (`/account/focus`)** — sets focus areas and content preferences (depth, format, reminders) that drive the recommendation engine.
- **Account settings (`/account`)** — display name, Morning Boost email opt-in, push toggle, password change.
- **Billing (`/account/billing`)** — plan/status display, Stripe billing portal link, invoice access.
- **My Actions (`/account/actions`)** — lightweight personal to-do list separate from the full plan.
- **Public profile editor (`/account/profile`)** — avatar, username, headline, bio, location.

---

## 4. Community (FN Network)

Requires an active membership.

- **Feed (`/network`)** — posts from joined groups, plus "your groups" / "discover groups" sidebar.
- **Groups directory (`/network/groups`)** — browse public groups; request-to-join workflow for private groups.
- **Group page (`/network/groups/[slug]`)** — description, member count, post composer (members/mods/owners/admins), paginated feed, pinned posts.
- **Members directory (`/network/members`)** — searchable member list; message or view-profile actions.
- **Direct messages (`/network/messages`, `/network/messages/[id]`)** — inbox with unread badges, new-message search, threaded conversation view with live polling.

---

## 5. Provider Program (member-side tools)

Available once a user's role is `PROVIDER`.

- **Business profile (`/account/business`)** — business name, specialty, services description, website, phone, service area — feeds the public provider directory and profile card.
- **My Contacts (`/account/provider/contacts`)** — the provider's own simple contact list (separate from the admin CRM).
- **My Campaigns (`/account/provider/campaigns`)** — create/send/track the provider's own email campaigns to their contacts (delivery/open stats, per-recipient log, HTML preview).

---

## 6. Ambassador Program (member-side tools)

Available once a user's role is `AMBASSADOR`.

- **Ambassador profile (`/account/ambassador`)** — territory, bio, website, phone; auto-provisions a unique referral code on first visit.
- **Referrals (`/account/referrals`)** — referral counts, conversion rate, full referral history table.
- **My Earnings (`/account/commissions`)** — commission totals by status (pending/approved/paid), payout-threshold messaging, earnings history.
- **Campaign materials (`/account/ambassador/materials`)** — read-only library of admin-published campaigns flagged for ambassador use, with copy-to-clipboard content.
- **Dashboard panel** — referral link/code with copy button, active promo codes, territory, onboarding checklist (tax info, payout account).

---

## 7. Admin Backend (`/admin`, requires `ADMIN` or `SUPER_ADMIN` staff access)

### 7.1 Dashboard & staff management
- **Dashboard (`/admin`)** — user/member/product counts, application funnel by status, conversion-rate cards, activation summary, recent sign-ups.
- **Users (`/admin/users`)** — edit membership role and staff access per user (staff-access edits are `SUPER_ADMIN`-only; Super Admins can't be demoted by a plain Admin).
- **Team (`/admin/team`, `SUPER_ADMIN`-only)** — invite/revoke staff access.
- **Audit Log (`/admin/audit`)** — filterable log of admin actions (applications, users, security, content, groups).
- **Settings (`/admin/settings`)** — site-wide key/value flags, logo upload, one-off maintenance actions.
- **Blocked Emails (`/admin/blocked-emails`)** — block/unblock addresses from submitting applications.

### 7.2 Applications review pipeline
- **Queue (`/admin/applications`)** — tabbed by review stage, filterable, CSV export, inline review actions (mark under review, request info, conditionally accept, accept, decline).
- **Application detail (`/admin/applications/[id]`)** — editable fields with mandatory edit reason, role-specific onboarding checklist, territory assignment, affiliate provisioning, pricing/payment record with Stripe payment links, directory-listing toggle, spam flagging, account-invite management, full event timeline, and prior-application history for the same email.

### 7.3 CRM: contacts, lists, custom fields, suppression
- **Contacts (`/admin/contacts`, `/[id]`, `/new`)** — full contact record: tags, notes, lists, per-topic consent, campaign history, addresses, custom fields, alternate identities, and **contact merge** (dedupes a duplicate into a survivor record).
- **CSV Import (`/admin/contacts/import`)** — flexible column mapping (handles Wix exports), live preview, consent handling, import-batch history.
- **Lists (`/admin/lists`, `/[id]`)** — static segment lists.
- **Custom Fields (`/admin/custom-fields`)** — define per-contact custom fields (text/number/date/dropdown/checkbox/URL/long text).
- **Suppression (`/admin/suppression`)** — global send-suppression list (bounce/complaint/unsubscribe/manual).

### 7.4 Campaigns, templates & automation
- **Campaigns (`/admin/campaigns`, `/new`, `/[id]`, `/[id]/edit`)** — 7-step creation wizard (details → content → UTM/tracking → test send → audience → schedule → review); A/B variants with traffic split; delivery/open/click/bounce metrics.
- **Audience Builder** — rule-based targeting (list, role, tag, consent topic, group, event RSVP, custom field) with AND/OR combination and exclusion rules, live preview count.
- **Email Block Composer** — drag-and-drop email building (heading, text, button, image, columns, dynamic content cards pulled live from events/blog/morning boost/resources/products, etc.).
- **Email Templates (`/admin/email-templates`)** — reusable marketing templates (draft/approved/retired).
- **Message Templates (`/admin/message-templates`)** — transactional lifecycle emails (application submitted, under review, accepted, declined, expired, etc.) with `{{variable}}` placeholders.
- **Automation Journeys (`/admin/automations`, `/[id]`)** — visual step-builder (trigger: manual/signup/role change/tag added/application accepted/group join/event RSVP/loyalty milestone; steps: wait, send email, add/remove tag, webhook, send push, condition-branch, exit); built-in starter templates. The list page (`/admin/automations`) leads with a stat strip (active journeys, running enrollments, completions this week, journeys needing attention) and groups journeys by activity — Needs attention (any outstanding failed enrollment) / Active-running / Active-idle / Inactive (collapsed by default) — with a colored status dot per row, instead of one flat table sorted by creation date.

### 7.5 Content management
- **Blog (`/admin/blog`)**, **Morning Boost (`/admin/morning-boost`)**, **Resources (`/admin/resources`)** — standard content CRUD with images/video, draft/published state.
- **Pathways (`/admin/pathways`)** — multi-stage program builder.
- **Challenges (`/admin/challenges`)** — multi-day program builder with per-day prompts and completion rewards.
- **Issue Topics (`/admin/issue-topics`)** and **Focus Areas (`/admin/focus-areas`)** — configuration for the recommendation engine.
- **Newsletter Topics (`/admin/newsletter-topics`)** — subscription topics contacts can opt into.
- **Questions (`/admin/questions`)** — inbound Ask The Fixer queue with reply-by-email workflow.
- **Contact Submissions (`/admin/contact`)** — inbound public contact-form inbox.

### 7.6 Community management
- **Groups (`/admin/groups`)** — create/manage community groups, auto-join rules by role.
- **Join Requests (`/admin/groups/[id]/requests`)** — approve/reject private-group join requests.
- **Events (`/admin/events`)** — create/manage events with pricing, capacity, RSVP tracking.

### 7.7 Territory management
- **Territories (`/admin/territories`)** — registry of geographic/industry/organization/custom territories with status and exclusivity. Assignment/revocation happens from the application detail page and respects locked/exclusive rules.

### 7.8 Affiliates, commissions & gift codes
- **Affiliates (`/admin/affiliates`, `/[id]`)** — status, promo codes, commission rules, full commission ledger, payout settings.
- **Commissions (`/admin/commissions`)** — cross-affiliate payout queue (approve/hold/reverse/mark paid, bulk pay).
- **Gift Codes (`/admin/gift-codes`)** — generate bulk role-granting redeemable codes.

### 7.9 Commerce
- **Products (`/admin/products`)** — catalog (membership/book/digital/physical), Stripe price sync.
- **Memberships (`/admin/memberships`)** — subscription roster with MRR and per-member lifetime value.

### 7.10 Loyalty & media
- **Loyalty (`/admin/loyalty`)** — member point totals; manual point award with note.
- **Media Library (`/admin/media`)** — shared image assets for campaigns/emails, with alt text and reuse tracking.

---

## 8. Underlying System Capabilities

These aren't pages, but they power several features above.

- **Authentication** — NextAuth credentials login (email + bcrypt), JWT sessions, optional TOTP second factor. Two independent role axes: membership tier (Consumer/Member/Provider/Ambassador) and staff access (None/Admin/Super Admin) — both re-read from the database on every request so promotions/demotions apply without re-login.
- **Rate limiting & bot protection** — a shared database-backed limiter caps abuse on public forms (contact, Ask The Fixer, registration, password reset, newsletter signup); a bot-user-agent blocklist and honeypot fields add a second layer; declined applicants face a cooldown before reapplying.
- **Cron jobs** — scheduled jobs for Morning Boost email sends, scheduled campaign sending (with stuck-send recovery), automation ticking, application expiration + reminder emails, account-invite reminders, and expired-token cleanup. Each job uses database locking so overlapping runs can't double-fire.
- **Stripe webhooks** — keep membership status in sync (subscription created/updated/canceled, payment succeeded/failed) and mark onboarding-fee payments complete.
- **Automation engine** — evaluates each active journey enrollment on every tick: sends email/push, adds/removes tags, calls webhooks, branches on a condition (role, tag, or days-since-signup), or exits — this is what actually runs the journeys built in §7.4.
- **Email system** — all transactional and marketing email goes through cPanel SMTP (no third-party ESP). Templates support `{{variable}}` substitution; campaign emails get an automatic unsubscribe footer and open-tracking pixel.
- **File uploads** — images and video go to Cloudinary (avatars, blog/resource covers, campaign media, Morning Boost video via signed direct upload).
- **Push notifications** — Web Push (VAPID) subscriptions, used by account settings and the automation engine's "send push" step.

---

## 9. Data Model Overview (plain-English map of the database)

The database has roughly 90 models. Grouped by what they're for:

- **Identity & auth** — accounts, sessions, admin invites, push subscriptions, audit log.
- **Products & membership** — sellable products/prices, a member's active subscription.
- **Applications** — the Provider/Ambassador application record and everything tracking its review lifecycle (checklist, events, onboarding pricing).
- **Provider & Ambassador profiles** — business/ambassador details, referral tracking.
- **Territory management** — territories and their assignment to applications/users.
- **Affiliates & commissions** — affiliate status, promo codes, commission rules and ledger.
- **Provider's own mini-CRM** — a provider's contacts and self-authored campaigns (kept separate from the admin CRM).
- **Community** — groups, membership, posts, comments, reactions, direct messages.
- **Content** — blog posts, Morning Boost entries, resources, events/RSVPs, gift codes, loyalty points.
- **Personal growth tracking** — focus areas, the Fixer Plan, growth pathways, challenges, daily check-ins, milestones, peer recognition, reflections, the issue-to-answer topic map, and the daily recommendation engine.
- **CRM (contacts)** — the central `Contact` record (can exist without a linked user, e.g. an imported lead) plus addresses, consent, tags, notes, lists, alternate identities, merge history, activity timeline, attribution source, import batches, custom fields, and the suppression list.
- **CRM (campaigns & templates)** — email templates, campaigns (with A/B variants and versioning), per-contact sends, audience snapshots, performance metrics, the shared media library, and newsletter topics.
- **Automation** — journeys, their ordered steps, per-contact enrollment progress, and the event log of what fired.
- **Support/inbound** — public contact-form submissions and Ask The Fixer questions.
- **Ops/infrastructure** — cron job locking, site-wide settings, and the rate-limit counter table.

For exact fields and relationships, `prisma/schema.prisma` is the source of truth — this section is a map, not a substitute for reading it.

---

## 10. Known Issues / Housekeeping

Small gaps surfaced while compiling this document — not fixed here, just flagged so they don't get lost:

- **Duplicate `/providers` route** — both `src/pages/providers.tsx` and `src/pages/providers/index.tsx` exist and target the same URL, which is a routing conflict in Next.js Pages Router. One is very likely dead code from a prior rework and should be reconciled/deleted.
- **Ask The Fixer has no membership gate** — it's fully public and unauthenticated today, unlike the "member-only with usage limits" behavior once assumed for it. Not necessarily wrong, just worth a deliberate decision rather than an accidental gap (see `docs/FNO_Testing_Reconciliation.md` item 7 for the full writeup).
- **CRM has no link between `ContactMessage`/`FixerQuestion` submissions and the `Contact` record** — inbound support messages don't currently attach to a contact's CRM timeline.

---

## Appendix: Where things live in the repo

```
src/
  pages/            Public + member pages (Pages Router)
    account/        Signed-in member features
    admin/          Admin backend
    api/            API routes (auth, admin, account, public, cron, webhooks)
    network/        FN Network community pages
  components/       Shared UI (layout, admin, account, ui primitives)
  lib/              Business logic: auth, email, automation, audience, rate-limit,
                     upload, web-push, referral/affiliate, loyalty, recommendations
prisma/
  schema.prisma     Full data model (source of truth for §9)
docs/
  FNO_FEATURES.md               This document
  FNO_Testing_Reconciliation.md e2e test coverage vs. this feature set
```
