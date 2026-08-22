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
1. The three cross-system closed loops (Member Growth, Provider Connection, Ambassador/Affiliate Attribution) — biggest single gap, and the guideline itself calls these the most important tests on the platform.
2. Territory management — real models + admin UI, zero coverage.
3. Audience Builder's actual AND/OR/exclusion logic in isolation (existing campaign spec only touches the audience *step*, not the logic).
4. Template & Asset Library (SP-31, built, untested).
5. Automation triggers individually + condition-branch behavior (only one Wait-step spec exists today).
6. Contact merge (SP-35, built, untested).
7. Ask the Fixer, contact form — pages exist, zero coverage.
8. Reviews/testimonials — existence unconfirmed; needs a quick check before deciding whether to spec or defer.
9. Basic privacy/security boundary sweep (cross-account URL access, admin routes as non-admin, verification/reset token replay).

**Deliberately out of scope** (standing prior agreement, still holds): Stripe billing/payment lifecycle (E2E-MEM-003–008), admin applications review funnel, browser push notification campaigns.

---

## 5. Recommended next steps

1. Add the two missing personas that unlock the most new coverage: a SUPER_ADMIN account (`TEST_SUPER_ADMIN_EMAIL/PASSWORD`) and a plain non-member registered user (or just register one ad hoc per test, like `admin-users.spec.ts` already does for its throwaway target).
2. Extend the existing suite — same conventions (isolated run → full-parallelism run → commit → push → poll to ● Ready → re-verify against production), not a parallel "master suite."
3. Priority order: closed-loop journeys → real-but-untested features (§4, item 4) → security/privacy sweep → spec-ambiguity write-ups, once product decisions are made on them.
4. Skip everything in the "not built at all" list until those features actually ship — testing them now would assert behavior against code that doesn't exist.
