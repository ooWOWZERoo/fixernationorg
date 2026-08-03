# Requirements Traceability Matrix — Stage 0

**Domain:** fixernation.org  
**Phase:** Stage 0 — Foundation, Hosting Validation, Architecture

| ID | Requirement | Status | Evidence / Files |
|---|---|---|---|
| FN-S0-HOST-001 | Document exact Hosting.com capabilities and constraints | ⏳ Pending cPanel | `docs/HOSTING_VALIDATION.md` — checklist ready |
| FN-S0-DB-001 | Prefer PostgreSQL; otherwise MySQL/MariaDB; do not finalize migrations before selection | ⏳ Pending cPanel | `prisma/schema.prisma` (PostgreSQL) · see ADR-002 |
| FN-S0-AUTH-001 | Prove Auth.js email/password, verification, reset, sessions, protected routes, Super Admin MFA | ✅ Scaffold | `src/lib/auth.ts` · `src/app/(auth)/signin/page.tsx` · `src/app/api/auth/[...nextauth]/route.ts` · `src/middleware.ts` |
| FN-S0-OPS-001 | Cron: locking, idempotency, retries, missed-run recovery | ✅ Scaffold | `src/app/api/cron/route.ts` · `prisma/schema.prisma#CronJob` |
| FN-S0-STOR-001 | Prove public and private file storage on Hosting.com | ⏳ Pending cPanel | `docs/HOSTING_VALIDATION.md` — checklist item |
| FN-S0-CICD-001 | CI/CD for development, staging, owner-authorized production | ✅ Scaffold | `.github/workflows/ci.yml` · `deploy-staging.yml` · `deploy-production.yml` |
| FN-S0-DESIGN-001 | Protected design-system preview: brand, typography, components, responsive, admin themes | ✅ Scaffold | `src/app/design/page.tsx` · `src/app/design/unlock/page.tsx` · `src/components/ui/` |
| FN-S0-DOC-001 | Architecture, security, testing, deployment, backup, risk documentation | ✅ Scaffold | `docs/ADR-001-framework.md` · `docs/ADR-002-database.md` · `docs/SECURITY.md` · `docs/DEPLOYMENT.md` · `docs/RISKS.md` |

## Acceptance Criteria Status

| Criterion | Status |
|---|---|
| Hosting capability report identifies all confirmed capabilities, limitations, and evidence | ⏳ Requires cPanel inspection |
| A supported database is selected and a migration proof completes successfully | ⏳ Requires cPanel confirmation |
| Minimal Next.js server-rendered, static, and route-handler proofs deploy successfully | ⏳ Requires staging deploy |
| Auth, Stripe webhook, Postmark, cron, storage, PostHog, and Sentry proofs pass | ⏳ Auth/Cron/Stripe scaffolded; live proof requires staging |
| CI/CD can deploy development and staging and can package an owner-authorized production release | ✅ Workflows created |
| Traceability matrix exists and Stage 0 findings clearly state whether Phase 1 may proceed | ✅ This document |
| Claude Code stops and waits for owner approval | ✅ Stage 0 scaffold complete — **awaiting owner approval to proceed to Phase 1** |

## Open Decisions

| Decision | Options | Notes |
|---|---|---|
| Database engine | PostgreSQL or MySQL/MariaDB | Must confirm PostgreSQL availability on Hosting.com plan before finalizing Prisma migrations |
| File storage | cPanel disk vs. external object storage | Hosting.com may overwrite files on deploy — needs proof from FN-S0-STOR-001 |
| Node.js version on cPanel | v20+ required for Next.js 15 | Existing FN Education project confirmed Node 24 available on this host |
| Next.js standalone vs. custom server | `output: "standalone"` is set | Must verify Passenger/cPanel supports running the standalone server |
