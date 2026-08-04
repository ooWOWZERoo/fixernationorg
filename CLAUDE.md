# CLAUDE.md — Fixer Nation (fixernation.org)

**Primary domain:** fixernation.org  
**Stack:** Next.js 15 (Pages Router) · TypeScript · Tailwind CSS · Prisma · next-auth v4 · Stripe · Postmark  
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

### Deploy process — build locally, push directly

**Builds run on your Mac** (not on the cPanel server). The CloudLinux nproc limit makes on-server builds unsafe. The build output is rsynced directly to the server via SSH.

#### Step 0 — SSH key setup (first time only)

```bash
# Generate a deploy key
ssh-keygen -t ed25519 -f ~/.ssh/fixernation_deploy -N ""

# Print the public key — copy this
cat ~/.ssh/fixernation_deploy.pub
```

Then in cPanel:
1. **SSH/Shell Access → Manage SSH Keys → Import Key**
2. Paste the public key, give it a name (e.g. `fixernation_deploy`)
3. Click **Authorize** next to the imported key
4. Test: `ssh -i ~/.ssh/fixernation_deploy fixernat@s16388.use1.stableserver.net exit`

#### Step 1 — Push to GitHub (version control)

```bash
cd /Users/john.shaw/Documents/Claude/Projects/FixerNationOrg
git push origin main
```

#### Step 2 — Run the deploy script

```bash
./deploy.sh
```

This builds Next.js on your Mac, then rsyncs `.next/standalone/` and `prisma/` to the server.

#### Step 3 — Restart on cPanel (manual, ~30 seconds)

1. Log into cPanel → **Setup Node.js App**
2. Click **Restart** next to the fixernation.org app

#### Step 4 — Verify

```
curl https://fixernation.org/api/health
```

---

### Running database migrations (when schema changes)

Migrations cannot run from the deploy script — they need `DATABASE_URL` which is only available in the Passenger process environment. Run from cPanel Terminal:

```bash
source /home/fixernat/nodevenv/repositories/fixernationorg/24/bin/activate
cd /home/fixernat/repositories/fixernationorg
DATABASE_URL="$(grep -oP "(?<=SetEnv DATABASE_URL ).*" ~/public_html/.htaccess)" \
  ./node_modules/.bin/prisma migrate deploy
```

**Stage 0 note:** no migration files exist yet. After Stage 0 validation, create a baseline migration:
```bash
./node_modules/.bin/prisma migrate dev --name init
```
Commit the generated `prisma/migrations/` directory.

---

### Environment variables

Set all env vars in **cPanel → Setup Node.js App → Environment variables** — do NOT use `.env` files (Passenger changes `process.cwd()`, making dotenv paths unreliable):

| Variable | Required | Value / Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | `postgresql://fixernat_fnapp:…@localhost:5432/fixernat_fixernationorg?connection_limit=3&pool_timeout=10` |
| `AUTH_SECRET` | ✅ | Min 32 chars — generate: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | ✅ | `https://fixernation.org` |
| `CRON_SECRET` | ✅ | Min 16 chars random string |
| `DESIGN_PREVIEW_PASSWORD` | ✅ | Password for /design preview gate |
| `UV_THREADPOOL_SIZE` | ✅ | `2` (reduces libuv thread pool, saves nproc slots) |
| `STRIPE_SECRET_KEY` | Phase 1 | |
| `STRIPE_WEBHOOK_SECRET` | Phase 1 | |
| `POSTMARK_SERVER_TOKEN` | Phase 1 | |
| `NEXT_PUBLIC_POSTHOG_KEY` | Phase 1 | |
| `SENTRY_DSN` | Phase 1 | |

### Node.js app config in cPanel (first-time setup)

- **Application root:** `repositories/fixernationorg`
- **Application URL:** `fixernation.org` (root, not a sub-path)
- **Application startup file:** `.next/standalone/server.js`
- **Node.js version:** 24.x (or latest available — minimum 20)

### Critical cPanel gotchas

1. **Restart required after every deploy** — Next.js does not hot-reload. Always restart after `./deploy.sh`.
2. **Env vars in cPanel UI, not `.env` files** — `process.cwd()` is unreliable under Passenger.
3. **nodevenv activation** — `node` is not on PATH by default in Terminal. Prefix commands with `source /home/fixernat/nodevenv/repositories/fixernationorg/24/bin/activate`.
4. **Prisma binary targets** — `schema.prisma` includes `debian-openssl-1.1.x` so the correct engine is bundled alongside the macOS native binary from local builds.
5. **Images unoptimized** — `next.config.js` sets `images: { unoptimized: true }` to avoid a macOS→Linux sharp binary mismatch in the standalone bundle. Remove in Phase 1 when image optimization is needed.
6. **On-server builds are blocked** — CloudLinux nproc kills Next.js workers during compilation. Never run `npm run build` on the cPanel server.

---

## Local dev commands

```bash
npm run dev          # Start dev server → http://localhost:3000
npm run build        # Production build
npm run type-check   # TypeScript check (no emit)
npm run lint         # ESLint
npm run db:generate  # Regenerate Prisma client after schema changes
npm run db:push      # Push schema to DB (dev only — no migration history)
npm run db:migrate   # Apply pending migrations (production)
npm run db:migrate:dev # Create + apply a new migration (dev)
npm run db:studio    # Prisma Studio GUI
./deploy.sh          # Build + deploy to production
```

---

## Project structure

```
src/
  pages/            Next.js Pages Router
    _app.tsx        Root wrapper (SessionProvider, Inter font)
    _document.tsx   HTML shell (lang, skip-link)
    index.tsx       Coming soon / home page
    signin.tsx      Sign-in page
    design/
      index.tsx     Design system preview (password-gated)
      unlock.tsx    Design preview unlock page
    api/
      auth/[...nextauth].ts   next-auth v4 route
      cron.ts       cPanel cron jobs endpoint
      health.ts     Health check
      design/unlock.ts        Design preview cookie setter
      webhooks/stripe.ts      Stripe webhook handler
  components/
    ui/             Button, Card, Input, Badge, Alert
    layout/         SiteHeader, SiteFooter (Phase 1)
  lib/
    auth.ts         next-auth v4 config (authOptions: NextAuthOptions)
    db.ts           Prisma client singleton
    env.ts          Zod-validated environment variables
    stripe.ts       Stripe client (stub until Phase 1)
    postmark.ts     Postmark client (stub until Phase 1)
  styles/
    globals.css     Tailwind base + CSS vars
  middleware.ts     Design preview gate
prisma/
  schema.prisma     Database schema (PostgreSQL)
deploy.sh           Local build + deploy script
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
next-auth v4 with `@next-auth/prisma-adapter`. Credentials provider (email + bcrypt). JWT sessions. `authOptions` exported from `src/lib/auth.ts`, used in `src/pages/api/auth/[...nextauth].ts`.

### Database
Prisma ORM, PostgreSQL. `db push` for local dev. `prisma migrate deploy` for production. Never use `db push` on production.

### Cron
cPanel calls `GET /api/cron?job=KEY&token=CRON_SECRET`. See `src/pages/api/cron.ts`.

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
