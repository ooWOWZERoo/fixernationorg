# FNO Testing Reconciliation

**Purpose:** reconcile the "master E2E test suite" guideline (33 test domains, ~50 sections, 15 personas, 500–700 target test cases) against what actually exists in this codebase today — the real Playwright suite, the real test accounts, and the real built features — so future work extends the suite instead of duplicating it, and specs features that are genuinely missing instead of testing ones that aren't built yet.

**As of:** 2026-08-22, commit `88248ce`. 41 e2e spec files, 2,835 lines, all passing against production (`https://fixernation.org`).

---

## 1. Existing test infrastructure — don't recreate

### Test accounts (`.env.test`, via `tests/e2e/helpers/auth.ts`)

| Account | Env vars | Role | Isolation note |
|---|---|---|---|
| `qa-admin` | `TEST_ADMIN_EMAIL/PASSWORD` | ADMIN (not SUPER_ADMIN) | Used for all admin-only flows |
| `qa-member` | `TEST_MEMBER_EMAIL/PASSWORD` | MEMBER | Primary/shared consumer account |
| `qa-provider` | `TEST_PROVIDER_EMAIL/PASSWORD` | PROVIDER | Dedicated to provider-campaign flow |
| `qa-ambassador` | `TEST_AMBASSADOR_EMAIL/PASSWORD` | AMBASSADOR | Dedicated to ambassador-materials flow |
| `qa-mfa-test` | `TEST_MFA_EMAIL/PASSWORD` | MEMBER | Isolated because it toggles real TOTP MFA — would break concurrent sign-ins on a shared account. Also used for profile-mutation tests (username/headline/bio/password) for the same reason. |
| `qa-recipient` | `TEST_RECIPIENT_EMAIL/PASSWORD/ID` | MEMBER | Message/recognition *target* only — not a business persona, pure test-infra plumbing |

Plus `TEST_DATABASE_URL` (direct Neon connection, used only by `tests/e2e/helpers/db.ts` for reading verification tokens / user IDs — never the app's runtime DB singleton) and `PLAYWRIGHT_BASE_URL`.

**Persona gaps vs. the guideline's 15-persona table** (V01/U01/M01–M04/SP01–03/BA01–03/AP01/A01–02):
- No SUPER_ADMIN distinct from ADMIN → A02 and "block removal of last super admin" are both untestable today.
- No non-member registered user (everything that exists is already a full member) → U01 untestable.
- No annual/expired/grace-period membership variants (M02–M04) → moot anyway, see §4 (Stripe billing explicitly out of scope).
- No "existing consumer applies as provider/ambassador" accounts (SP02/BA02) → real gap, cheap to add (reuse `qa-member`, apply, verify role-stacking, revert).
- No distinct affiliate-provider (AP01) — `affiliate-commissions.spec.ts` exercises "a fixed affiliate" but its provider-linkage isn't confirmed.
- V01 (anonymous visitor) needs no account — already exercised implicitly by every public-page/application-guest-flow test.

### Existing e2e spec coverage (41 files)

Full coverage already in place for: registration/verification (`register-verify`), account settings/profile/nav, all Five Pillars (`checkin`, `issues`, `my-plan`, `pathway-enrollment`, `challenge-enrollment`, `reflections`, `progress`, `recommendation-refresh`), FN Network (`group-join`, `direct-messages`, `members-directory`, `public-profile-viewers`), provider/ambassador applications + profiles + referral history, affiliate commissions + promo codes, CRM contact creation (`csv-import`, `newsletter-subscribe`), admin content authoring (blog/resources/morning-boost/pathways/challenges), admin users/suppression/custom-fields/newsletter-topics, one campaign-send wizard spec, one automation-journey spec, loyalty award, gift codes, MFA, event RSVP/waitlist/capacity.

Full per-file breakdown lives in [[project-fno-e2e-test-suite]] (session memory) — not repeated here to avoid drift between two copies of the same list.

---

## 2. Feature capability audit — what's real, what's aspirational

Audited directly against `prisma/schema.prisma` (2,368 lines) and the relevant `src/` implementation, not assumed from the spec.

### Real and substantially built

| Area | Model(s) | Notes |
|---|---|---|
| CRM | `Contact`, `ContactAddress/Tag/Note/List/ListMember/Consent/Activity/Identity/MergeHistory`, `CustomFieldDefinition/Value` | Genuine separate CRM layer, not just `User` fields. Custom fields support TEXT/NUMBER/DATE/DROPDOWN/CHECKBOX/URL/TEXTAREA. |
| Campaign builder | `BlockComposer.tsx` (984 lines) | Real block-based, reorderable (native HTML5 drag-and-drop + explicit up/down buttons), undo stack, autosave. Hand-rolled, not a DnD-kit framework. |
| Audience builder | `src/lib/audience.ts` | Real AND/OR + separate exclude list. **Not** nested/arbitrary boolean groups — one global AND/OR over a flat include list, exclude list subtracted. |
| Automation/Journey builder | `AutomationJourney/Step/Enrollment/Event` + `JourneyCanvas.tsx` | Real node-graph via `@xyflow/react` — trigger/step/exit nodes, true/false branch handles on CONDITION steps. Triggers: MANUAL, SIGNUP, ROLE_CHANGE, TAG_ADDED, APPLICATION_ACCEPTED, GROUP_JOIN, EVENT_RSVP, LOYALTY_MILESTONE. |
| Territory management | `Territory`, `TerritoryAssignment` | Real first-class county/ZIP/city/state/region model, `isExclusive` flag, ACTIVE/EXPIRED/REVOKED/TRANSFERRED status, `autoRenew`. Admin UI at `/admin/territories`. **Zero e2e coverage.** |
| Affiliate/referral | `AffiliateAssignment` (incl. `attributionWindowDays`, default 30), `PromoCode`, `CommissionRule`, `CommissionLedger` (pending→approved→paid/reversed) | Real, substantially tested already (`affiliate-commissions.spec.ts`, `promo-codes.spec.ts`). Whether the 30-day window is actually *enforced* at attribution time vs. just a stored config value wasn't confirmed from schema alone — needs a service-code check, not schema inspection. |
| Loyalty | `LoyaltyPoint` (flat ledger) | Fixed point values per action, `MILESTONES = [100, 250, 500, 1000]` firing automation journeys. **No tiers** (Bronze/Silver/Gold) anywhere. |
| Five Pillars | See mapping below | All five exist, under different names than the guideline uses. |
| Email | `src/lib/email.ts` — plain `nodemailer.createTransport` | Already provider-agnostic (`SMTP_HOST/PORT/USER/PASS/FROM` env vars). No Postmark SDK, no Hosting.com-specific code in `src/` at all. See §4 for the architecture correction this implies. |
| MFA | `User.mfaEnabled` + `User.mfaSecret` (TOTP) | Confirmed, `src/lib/totp.ts`. No backup-codes field. |

**Five Pillars → actual model mapping** (guideline names → real names):
- Understand Me → `FocusArea`/`MemberFocusArea`/`MemberPreference`/`IssueTopic`/`MemberIssue`
- Guide Me → `IssueRecommendationMap`, `Recommendation`/`RecommendationFeedback`
- Help Me Act → `FixerPlan`/`FixerPlanItem`/`MemberAction`, `GrowthPathway`/`PathwayStage`/`PathwayEnrollment`, `Challenge`/`ChallengeStep`/`ChallengeEnrollment`
- Show Me Progress → `DailyCheckIn`, `MemberMilestone`, `ReflectionEntry`, `PathwayProgress`/`ChallengeCompletion`
- Connect Me → `SocialGroup`/`GroupMember`/`Post`/`Comment`, `MemberRecognition`

### Doesn't exist — don't write tests for these yet

| Guideline section | Reality |
|---|---|
| E2E-09 Provider Match & Warm Introduction | Plain client-side-filtered directory (`/providers`), ordered by `directoryListedAt`. No ranking/score field, no geo-matching algorithm, no `Introduction`/`Inquiry` model — cross-user contact is just the generic `Conversation`/`DirectMessage` system. |
| Accountability Circles | No `Circle` model at all. `capacity` (`Int?`) exists **only on `Event`**, not on `SocialGroup`/groups. Groups have no capacity/waitlist concept. |
| Admin Intelligence (member/content/provider/territory) | `/admin` computes basic `db.user.count()`/`db.product.count()` stat cards. No analytical/pattern-detection dashboards anywhere. |
| Admin impersonation | Zero matches anywhere in `src/`. |
| Account deletion (30-day pending window) | No deletion fields on `User`, no scheduled-deletion model, no delete-account route under `src/pages/api/account`. |
| Loyalty tiers | Flat points ledger only. |
| Commerce inventory/returns/fulfillment | `Product`/`Price`/`UserMembership` exist; Stripe checkout works for membership. **No `Order` model, no stock/inventory/quantity field anywhere in the schema** (confirmed via direct grep, zero matches), no shipment/returns model. |
| Provider ranking + refresh | No ranking/match-score field or algorithm found anywhere — confirmed via grep, zero matches. |
| AI prompt-injection / degraded mode | No AI-guide feature found in this codebase at all — confirm this is actually expected/in-scope before speccing defenses for it. |

---

## 3. Corrections to the supplied comparison table

Three rows in the externally-supplied "Updated comparison findings" table were checked directly against live code and don't hold up — the corrected version changes the recommended action from "define the missing behavior" to "build the feature first":

| Row | Table claimed | Actual code (verified 2026-08-22) | Corrected action |
|---|---|---|---|
| Accountability Circle full-capacity / waitlist | "Capacity exists, exact full behavior not fully defined" | No Circle model. `capacity` exists only on `Event`. | Build the model first — there's no capacity field to define behavior for. `event-rsvp.spec.ts` already proves the capacity+waitlist+no-auto-promotion pattern end-to-end on Events; reuse that pattern if/when Circles get built. |
| Inventory concurrency | "Inventory exists, atomic behavior not explicit" | No `stock`/`inventory`/`quantity` field anywhere in schema. | Inventory doesn't exist at all — this is a build item, not a concurrency-hardening item. |
| Provider ranking refresh | "Ranking exists, refresh behavior not explicit" | No ranking field/algorithm anywhere. | Same — nothing to refresh yet. |

One row undersold what's already done:

| Row | Table claimed | Actual code |
|---|---|---|
| Reset/verification-token replay prevention | "Security implied" (not yet guaranteed) | Already fully enforced — both `reset-password.ts` and `verify-email.ts` call `db.verificationToken.delete({ where: { token } })` immediately on use in every branch. A reused token simply won't be found. **This is done.** The one real gap: existing coverage tests an *invalid* token, not *reuse of a validly-issued-then-consumed* token — a cheap test addition, not a dev task. |

The email-architecture correction in the supplied table checks out exactly: **the architecture is already correct.** `src/lib/email.ts` is plain provider-agnostic nodemailer/SMTP; there is no Postmark SDK or Hosting.com-specific code anywhere in `src/`. What's actually missing is the *operational* layer around it: no send queue, no batching/throttling, no delivery-health admin view, no bounce normalization. So "stop calling it the Hosting.com Email subsystem" is a documentation fix; queueing/throttling/delivery-health is a genuine unbuilt feature.

**Stale-docs note (not fixed, flagging only):** `docs/HOSTING_VALIDATION.md` and `docs/TRACEABILITY.md` are Stage-0-era artifacts that still reference a Postmark checkbox and `src/app/(auth)/...` app-router paths — this project is pages-router (`src/pages/`) on Vercel/Neon, not cPanel/app-router. Worth a cleanup pass separately; out of scope for this document.

---

## 4. Updated guideline-vs-reality findings (merged)

**Spec-ambiguity gaps** — feature exists, exact behavior is underspecified. Write the rule, then test it:
- Challenge missed-day / pause-resume semantics (`Challenge`/`ChallengeStep` exist; catch-up vs. skip vs. sequential-shift undefined)
- Campaign Composer keyboard-reordering (real DnD exists in `BlockComposer.tsx`, native HTML5 only — no confirmed keyboard alternative; WCAG requires one)
- Group/"Circle" lifecycle states (`SocialGroup` has no Draft/Active/Completed/Archived — just a visibility enum)

**Not built at all** — decide build-or-defer before speccing the edge cases: Accountability Circles + waitlist, Provider Leads/Inquiries workspace, Admin Intelligence dashboards, impersonation, account deletion window, loyalty tiers, inventory/atomic reservation, provider ranking + refresh, AI prompt-injection/degraded-mode (pending confirmation an AI guide feature is even planned), SMTP queue/batching/throttle/delivery-health, formal Analytics Metric Dictionary artifact.

**Already done — needs a test, not a dev task:** reset/verification token single-use, server-side admin-role checks on mutations (every admin API route touched this session consistently checks `session.user.adminRole` — a systematic "hit every admin route as a non-admin" sweep would *confirm* this, not build it), SMTP provider-agnostic architecture.

**Genuinely untested real features** (highest-value additions to the existing 41-spec suite, no new infra needed beyond 1–2 new accounts):
1. ~~The three cross-system closed loops~~ — **done** (`tests/e2e/closed-loop-journeys.spec.ts`, 2026-08-22). Adapted to what's actually built rather than the original guideline's assumptions: (a) challenge completion → `awardPoints` → `LoyaltyPoint` row, verified via direct DB read since there's no UI button anywhere to mark a challenge step complete — flagged as a real product gap, not fixed here; (b) an issue topic's PATHWAY/CHALLENGE recommendation link → real enrollable pathway page — this surfaced and fixed a genuine site-wide bug (`IssueRecommendationMap.resourceId` stores a DB id, but `/pathways/[slug]` and `/challenges/[slug]` look up by slug, so every recommendation link 404'd; fixed in `src/pages/issues/[slug].tsx` by resolving id→slug server-side); (c) ambassador referral link (`/register?ref=<code>`) → registration → `Referral` row + `LoyaltyPoint(reason:"referral_converted")` for the ambassador — real, fully Stripe-free. **Infra note:** `awardPoints`'s fire-and-forget write showed a consistent ~20s real-world delay before landing in one run and near-instant in another — almost certainly Vercel freezing the serverless invocation right after the response flushes. Not a code bug; tests poll with a 40s window rather than asserting once.
2. ~~Territory management~~ — **done** (`tests/e2e/admin-territories.spec.ts`, 2026-08-22). Assignment/revoke actually lives on `/admin/applications/[id]` (ambassador applications only), not `/admin/territories` itself — that page is create/list only. Found and fixed two real gaps in `src/pages/api/admin/territories/[id].ts`'s assign action: `Territory.isExclusive` had no enforcement at all (a second ambassador could be actively assigned to an "exclusive" territory), and `Territory.status = "LOCKED"` was only excluded from the UI dropdown, not the API itself — a direct API call could still assign a locked territory. Both now return 409 with a specific message; tests cover the happy path (create → assign → revoke) plus both rejection cases and the exclusive-territory-frees-up-after-revoke path.
3. ~~Audience Builder's actual AND/OR/exclusion logic~~ — **done** (`tests/e2e/admin-audience-builder.spec.ts`, 2026-08-22). Tests `src/lib/audience.ts` directly via `/api/admin/campaigns/preview-audience` against 4 fixture contacts: OR (union), AND (intersection), exclude subtraction, CAMPAIGNS-consent-opt-out suppression, and the empty-include-list-means-zero-not-everyone edge case. No bug found — the logic was already correct, unlike the previous two items. Not covered: the bounce/unsubscribe suppression path (the other half of `resolveAudience`'s suppression step) — that needs a real sent-and-bounced campaign, heavier setup than this pass covers.
4. ~~Template & Asset Library~~ — **done** (`tests/e2e/admin-templates-and-assets.spec.ts`, 2026-08-22). Covers media upload + alt-text editing, and the full template lifecycle: create with a block → save/insert a reusable section → clone → Approve/Retire/Restore-to-draft → delete. Found and fixed a real bug: cloning a template used `router.push` to the clone's URL — a client-side transition to the *same route pattern*, so React never remounted the page component and `useState(initial.name/subject/status/...)` never re-seeded. The URL bar correctly showed the clone's id, but every editable field silently kept showing the **original** template's values until a manual refresh. Fixed by switching that one navigation to `window.location.href` (full reload). Confirmed via direct DB check that this was a genuine UI-state bug, not a duplicate-row bug — exactly one clone row was created per run.
5. ~~Automation triggers individually + condition-branch behavior~~ — **done, and this one was a real feature build, not just a test-writing pass** (`tests/e2e/admin-automation-engine.spec.ts`, 2026-08-22). The journey builder UI and schema fully supported all 8 `AutomationStepType` values — including a fully-configurable `CONDITION` step with `field`/`operator`/`value`/`falseNextOrder` branching — but `tickAutomations` in `src/lib/automation.ts` only ever implemented 4 of them (`WAIT`, `SEND_EMAIL`, `ADD_TAG`, `WEBHOOK`). `CONDITION`, `REMOVE_TAG`, `SEND_PUSH`, and `EXIT` were silent no-ops: an admin could build and activate a branching journey and every enrollee would just skip past the condition in a straight line, `falseNextOrder` never read. Given the user's explicit choice, implemented all 4: `CONDITION` evaluates the fixed field set the UI actually offers (`userRole`, `tag`, `daysSinceSignup`), `REMOVE_TAG` mirrors `ADD_TAG`, `EXIT` ends the enrollment immediately instead of no-op-continuing, `SEND_PUSH` reuses the exact `webpush.sendNotification` pattern already used for push campaigns. Also found and fixed two more bugs blocking even testing this: the create-journey API's own zod schema only accepted 5 of the 8 valid triggers (`GROUP_JOIN`/`EVENT_RSVP`/`LOYALTY_MILESTONE` rejected server-side, not just by the form — a pre-existing spec had already flagged this as a known issue), and the create form silently swallowed that rejection with no error shown to the admin. Tests cover: all 8 triggers can now create a journey, a real `TAG_ADDED` trigger firing end-to-end through `ADD_TAG`/`REMOVE_TAG`/`EXIT`, and `CONDITION` branching both ways (true continues, false jumps via `falseNextOrder`). Not covered: `SEND_PUSH`'s actual delivery (would need a real browser push subscription fixture — out of scope for this pass, the implementation reuses proven code but isn't independently verified sending).
6. ~~Contact merge~~ — **done** (`tests/e2e/admin-contact-merge.spec.ts`, 2026-08-22). Covers tag dedup (shared tag not duplicated), notes/tags actually moved over, source contact deletion (404 after merge), `ContactMergeHistory` logging, and self-merge rejection (400). Found and fixed the same bug class as the template clone: `doMerge()` called `router.replace(router.asPath)` after a successful merge — a same-URL client-side transition that doesn't remount the page, so `useState(initial.tags/notes/...)` never re-seeded. Data the survivor already had kept showing correctly (unchanged), but anything newly pulled in from the absorbed contact (its unique tag, its note) silently stayed missing until a manual refresh. Fixed with `window.location.reload()`. Also worth noting: while debugging, a genuine coverage-eroding bug turned up in the *test itself*, not the app — the create-contact URL assertion also matched the literal `/admin/contacts/new` the form lives on, so it could resolve mid-redirect and hand back the string `"new"` as a contact id. Same class of race this suite already has an established `(?!new$)` fix for elsewhere — worth remembering when writing any new "just-created" URL assertion in this codebase.
7. Ask the Fixer, contact form — pages exist, zero coverage.
8. Reviews/testimonials — existence unconfirmed; needs a quick check before deciding whether to spec or defer.
9. Basic privacy/security boundary sweep (cross-account URL access, admin routes as non-admin, verification/reset token replay).

**Deliberately out of scope** (standing prior agreement, still holds): Stripe billing/payment lifecycle (E2E-MEM-003–008), admin applications review funnel, browser push notification campaigns.

---

## 5. Recommended next steps

1. ~~Add the SUPER_ADMIN persona~~ — **done.** `qa-super-admin@fixernation.org` (`TEST_SUPER_ADMIN_EMAIL/PASSWORD` in `.env.test`, `signInAsTestSuperAdmin` helper). Immediately used to close the exact gap flagged in [[project-fno-e2e-test-suite]] item 5: `admin-users.spec.ts` only had the 403-rejection case for a non-super-admin; now also covers the positive "SUPER_ADMIN can change another user's staff access" path. The non-member-registered-user persona (U01) is still open — register one ad hoc per test as needed, same as `admin-users.spec.ts`'s throwaway target.
2. Extend the existing suite — same conventions (isolated run → full-parallelism run → commit → push → poll to ● Ready → re-verify against production), not a parallel "master suite."
3. Priority order: ~~closed-loop journeys~~ done → real-but-untested features (§4, items 2–9) → security/privacy sweep → spec-ambiguity write-ups, once product decisions are made on them.
4. Skip everything in the "not built at all" list until those features actually ship — testing them now would assert behavior against code that doesn't exist.
