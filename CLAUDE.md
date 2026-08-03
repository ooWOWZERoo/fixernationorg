# CLAUDE.md — Fixer Nation (fixernation.org)

**Primary domain:** fixernation.org  
**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS · Prisma · Auth.js v5 · Stripe · Postmark  
**Hosting:** Hosting.com cPanel shared hosting  
**Status:** Stage 0 scaffold — awaiting owner approval before Phase 1

This is a NEW project separate from fixernationeducation.com (which runs the FN Education curriculum portal).

## Commands

```bash
npm run dev          # Start local dev server → http://localhost:3000
npm run build        # Production build
npm run type-check   # TypeScript check (no emit)
npm run lint         # ESLint
npm run db:generate  # Regenerate Prisma client after schema changes
npm run db:push      # Push schema to DB (dev only — no migration history)
npm run db:migrate   # Apply pending migrations (staging/production)
npm run db:migrate:dev # Create + apply a new migration (dev)
npm run db:studio    # Prisma Studio GUI
```

## Project Structure

```
src/
  app/              Next.js App Router pages and API routes
    (auth)/         Sign-in, auth layout
    design/         Design system preview (password-gated)
    api/
      auth/         Auth.js route handler
      cron/         cPanel cron jobs endpoint
      health/       Health check
      webhooks/stripe/  Stripe webhook handler
  components/
    ui/             Button, Card, Input, Badge, Alert
    layout/         SiteHeader, SiteFooter (Phase 1)
  lib/
    auth.ts         Auth.js v5 config (NextAuth)
    db.ts           Prisma client singleton
    env.ts          Zod-validated environment variables
    stripe.ts       Stripe client (stub until Phase 1)
    postmark.ts     Postmark client (stub until Phase 1)
  middleware.ts     Auth protection + design preview gate
prisma/
  schema.prisma     Database schema (PostgreSQL preferred / MySQL fallback)
docs/
  TRACEABILITY.md   Requirements → code mapping
  HOSTING_VALIDATION.md  cPanel inspection checklist
  ADR-001-framework.md
  ADR-002-database.md
  SECURITY.md
  DEPLOYMENT.md
  RISKS.md
```

## Architecture

### Two separate concerns from day one
- **Public / member site** — server-rendered Next.js pages, Tailwind CSS, App Router
- **Admin backend** — protected `/admin/*` routes (Phase 1), same Next.js app

### Auth
Auth.js v5 with Credentials provider (email + bcrypt). JWT sessions (required for Credentials). Email verification is enforced before any sign-in. MFA for Super Admin is wired in Phase 1.

Never mix admin and member sessions — they will use the same `User` table but different `UserRole` values.

### Database
Prisma ORM. Database engine TBD pending cPanel validation (ADR-002). Do NOT write migrations until `provider` is confirmed. Use `prisma db push` for local dev.

### Cron
cPanel calls `GET /api/cron?job=KEY&token=CRON_SECRET`. The handler acquires a `CronJob` row lock, executes, and records the result. See `src/app/api/cron/route.ts`.

### Stripe
Webhook at `/api/webhooks/stripe`. Signature verified against `STRIPE_WEBHOOK_SECRET`. Keys not required until Phase 1.

### Design system preview
Password-gated at `/design` using cookie `fn_design_preview`. Password from `DESIGN_PREVIEW_PASSWORD` env var. Unlock at `/design/unlock`.

## Deployment — cPanel

**No local preview for production.** All staging/production verification happens on the live server.

Routine deploy sequence in cPanel Terminal:
```bash
source ~/nodevenv/repositories/fixernation-org/20/bin/activate && \
  cd ~/repositories/fixernation-org && \
  git pull origin main && \
  npm ci && \
  npm run build && \
  npm run db:migrate
# Then restart: cPanel → Setup Node.js App → Restart
```

See `docs/DEPLOYMENT.md` for the full procedure, first-time setup, and rollback steps.

### Critical cPanel gotchas (inherited from FN Education project)

1. **`process.cwd()` is wrong under Passenger** — do NOT load env via `require('dotenv').config()`. Set env vars in cPanel's "Setup Node.js App" environment section instead.
2. **Restart required after ANY server-side code change** — Next.js does not hot-reload in production. Pull + build is not enough.
3. **`npm ci` required after any `package.json` change** — cPanel doesn't auto-install new deps.
4. **NEVER use `rsync --delete-excluded`** — it will wipe the `api/` proxy directory and break the app. Use `--delete` only.
5. **`node` is not on PATH in cPanel Terminal** — always activate the nodevenv prefix first (see deploy command above).

## Governing Rules

1. The project owner retains all design, development, staging, production, and release authority.
2. Development → staging → production only; never promote to production without owner authorization.
3. Do not invent business rules. Flag conflicts or missing decisions.
4. All authorization and entitlement checks are enforced server-side.
5. All financial, consent, security, and admin actions must be auditable.
6. Do not add Fixer Nation Education content, school, teacher, classroom, student, or education portal features to this project.
7. Do not build Phase N+1 features during Phase N.

## Phase Overview

| Phase | Summary | Status |
|---|---|---|
| Stage 0 | Foundation, hosting validation, architecture, design system | ✅ Scaffold complete — awaiting owner approval |
| Phase 1 | Public site + paid consumer membership + admin backend | Not started |
| Phase 2 | FN Network — private social community | Not started |
| Phase 3 | Service Provider Program and Directory | Not started |
| Phase 4 | Ambassador, Territory, and Affiliate Platform | Not started |
| Phase 5 | Advanced Commerce, Events, Gifts, Full Loyalty | Not started |
| Phase 6 | Platform Expansion, Scale, Mobile Readiness, Organizations | Not started |

## Stage 0 Completion Gate

Do not proceed to Phase 1 until:
- [ ] `docs/HOSTING_VALIDATION.md` checklist is complete
- [ ] Database engine (PostgreSQL or MySQL) is confirmed and Prisma `provider` is updated
- [ ] Next.js standalone mode is proven to work on cPanel
- [ ] Staging deploy passes the health check
- [ ] Owner has accepted the staging release
