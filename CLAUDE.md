# CLAUDE.md — Fixer Nation (fixernation.org)

**Primary domain:** fixernation.org  
**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS · Prisma · Auth.js v5 · Stripe · Postmark  
**Status:** Stage 0 scaffold — awaiting owner approval before Phase 1

This is a NEW project. It is NOT fixernationeducation.com (the FN Education Express/MariaDB app on s3074).

---

## DEPLOY — read this every session

### Connections

| Resource | Value |
|---|---|
| GitHub | https://github.com/ooWOWZERoo/fixernationorg |
| cPanel server | s16388.use1.stableserver.net |
| cPanel user | fixernat |
| App root (server) | ~/repositories/fixernationorg |
| DB engine | PostgreSQL |
| DB credentials | Set in cPanel → Setup Node.js App → Environment variables |

### Deploy process — GitHub Actions CI/CD

**Builds run on GitHub Actions (Ubuntu), not on the cPanel server.** The CloudLinux process limit makes on-server builds impossible; GitHub Actions has no such restriction.

#### Step 1 — Push to GitHub

```bash
cd /Users/john.shaw/Documents/Claude/Projects/FixerNationOrg
git push origin main
```

#### Step 2 — Trigger the deployment

1. Go to **GitHub → Actions → Deploy — Production**
2. Click **Run workflow**
3. Check "I confirm this release has been approved by the project owner"
4. Click **Run workflow**

The workflow: installs → builds → rsyncs `.next/standalone/` to server → runs `prisma migrate deploy`.

#### Step 3 — Restart on cPanel (manual, ~30 seconds)

After the workflow succeeds:
1. Log into cPanel → **Setup Node.js App**
2. Click **Restart** next to the fixernation.org app

#### Step 4 — Verify

```
https://fixernation.org/api/health
```

---

### First-time DB schema setup (one-time only)

No migration files exist yet. Before the first deploy, push the schema directly from cPanel Terminal:

```bash
source /home/fixernat/nodevenv/repositories/fixernationorg/24/bin/activate && \
  cd /home/fixernat/repositories/fixernationorg && \
  ./node_modules/.bin/prisma db push
```

After Stage 0 validation, create a proper baseline migration:
```bash
./node_modules/.bin/prisma migrate dev --name init
```
Commit the generated `prisma/migrations/` directory; subsequent deploys use `migrate deploy`.

---

### GitHub Secrets required

Add these in **GitHub → repository → Settings → Secrets and variables → Actions**:

| Secret name | Value |
|---|---|
| `DEPLOY_SSH_KEY` | Ed25519 private key (full PEM including `-----BEGIN/END-----` lines) |
| `DEPLOY_HOST` | `s16388.use1.stableserver.net` |
| `DATABASE_URL` | `postgresql://fixernat_fnapp:FixerNation123!@localhost:5432/fixernat_fixernationorg` |
| `AUTH_SECRET` | `WS6GvF7BmXnKKpOIG0R7z0jxZ/1mH4mPU76D9oW7OPk=` |
| `AUTH_URL` | `https://fixernation.org` |
| `CRON_SECRET` | `176246ce05c4bde3ff40b30be93025fa` |
| `DESIGN_PREVIEW_PASSWORD` | `preview` |

### Environment variables

Set all env vars in **cPanel → Setup Node.js App → Environment variables** — do NOT rely on `.env` files in the repo (Passenger/LiteSpeed changes `process.cwd()`, making relative dotenv paths unreliable):

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `AUTH_SECRET` | ✅ | Min 32 chars — generate with `openssl rand -base64 32` |
| `AUTH_URL` | ✅ | `https://fixernation.org` |
| `CRON_SECRET` | ✅ | Min 16 chars random string |
| `DESIGN_PREVIEW_PASSWORD` | ✅ | Password for /design preview gate |
| `STRIPE_SECRET_KEY` | Phase 1 | |
| `STRIPE_WEBHOOK_SECRET` | Phase 1 | |
| `POSTMARK_SERVER_TOKEN` | Phase 1 | |
| `NEXT_PUBLIC_POSTHOG_KEY` | Phase 1 | |
| `SENTRY_DSN` | Phase 1 | |

### Node.js app config in cPanel (first-time setup)

When setting up the Node.js app for the first time:
- **Application root:** `repositories/fixernationorg`
- **Application URL:** `fixernation.org` (root, not a sub-path)
- **Application startup file:** `.next/standalone/server.js`
- **Node.js version:** 24.x (or latest available — minimum 20)

### Critical cPanel gotchas

1. **Restart required after ANY deploy** — Next.js does not hot-reload in production. Manual restart in Setup Node.js App is the final step every time.
2. **Env vars in cPanel UI, not `.env` files** — `process.cwd()` is unreliable under Passenger. All vars must be set in cPanel → Setup Node.js App → Environment variables.
3. **nodevenv activation** — `node` is not on PATH by default. Always prefix manual cPanel Terminal commands with `source /home/fixernat/nodevenv/repositories/fixernationorg/24/bin/activate`.
4. **Prisma binary targets** — the standalone is built on Ubuntu (GitHub Actions). The `binaryTargets` in `prisma/schema.prisma` include RHEL variants so the correct engine binary is bundled for the cPanel server (CloudLinux).
5. **On-server builds are permanently broken** — CloudLinux's per-user `nproc` limit kills Next.js worker processes during static generation (EAGAIN). Build only on GitHub Actions.

---

## Local dev commands

```bash
npm run dev          # Start dev server → http://localhost:3000
npm run build        # Production build
npm run type-check   # TypeScript check (no emit)
npm run lint         # ESLint
npm run db:generate  # Regenerate Prisma client after schema changes
npm run db:push      # Push schema to DB (dev only — no migration history)
npm run db:migrate   # Apply pending migrations (staging/production)
npm run db:migrate:dev # Create + apply a new migration (dev)
npm run db:studio    # Prisma Studio GUI
```

---

## Project structure

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
    auth.config.ts  Edge-safe auth config (middleware only)
    db.ts           Prisma client singleton
    env.ts          Zod-validated environment variables
    stripe.ts       Stripe client (stub until Phase 1)
    postmark.ts     Postmark client (stub until Phase 1)
  middleware.ts     Auth protection + design preview gate
prisma/
  schema.prisma     Database schema (PostgreSQL)
docs/
  TRACEABILITY.md   Requirements → code mapping
  HOSTING_VALIDATION.md  cPanel inspection checklist (complete before Phase 1)
  ADR-001-framework.md
  ADR-002-database.md
  SECURITY.md
  DEPLOYMENT.md
  RISKS.md
```

---

## Architecture

### Auth
Auth.js v5 with Credentials provider (email + bcrypt). JWT sessions. Email verification enforced before sign-in. **Edge-safe split:** `auth.config.ts` is used in middleware (no bcrypt, no Prisma adapter); `auth.ts` is used in server components and API routes only.

### Database
Prisma ORM, PostgreSQL. Use `prisma db push` for local dev. Use `npx prisma migrate deploy` for production. Do NOT use `db push` on production.

### Cron
cPanel calls `GET /api/cron?job=KEY&token=CRON_SECRET`. See `src/app/api/cron/route.ts`.

### Design system preview
Password-gated at `/design` via cookie `fn_design_preview`. Unlock at `/design/unlock`. Password = `DESIGN_PREVIEW_PASSWORD` env var.

---

## Governing rules

1. The project owner retains all design, development, staging, production, and release authority.
2. Development → staging → production only; never promote to production without owner authorization.
3. Do not invent business rules. Flag conflicts or missing decisions.
4. All authorization and entitlement checks are enforced server-side.
5. All financial, consent, security, and admin actions must be auditable.
6. Do not add Fixer Nation Education content (school, teacher, classroom, student, FNE) to this project.
7. Do not build Phase N+1 features during Phase N.

---

## Phase overview

| Phase | Summary | Status |
|---|---|---|
| Stage 0 | Foundation, hosting validation, architecture, design system | ✅ Scaffold complete — awaiting owner approval |
| Phase 1 | Public site + paid consumer membership + admin backend | Not started |
| Phase 2 | FN Network — private social community | Not started |
| Phase 3 | Service Provider Program and Directory | Not started |
| Phase 4 | Ambassador, Territory, and Affiliate Platform | Not started |
| Phase 5 | Advanced Commerce, Events, Gifts, Full Loyalty | Not started |
| Phase 6 | Platform Expansion, Scale, Mobile Readiness, Organizations | Not started |

---

## Stage 0 completion gate

Do not proceed to Phase 1 until ALL of these are checked:

- [ ] `docs/HOSTING_VALIDATION.md` checklist is complete (run by owner on cPanel)
- [ ] PostgreSQL availability confirmed on this hosting plan
- [ ] Next.js standalone mode (`server.js`) proven to work as the cPanel startup file
- [ ] All environment variables set in cPanel Node.js app
- [ ] Staging deploy passes health check at `/api/health`
- [ ] Owner has accepted the staging release
