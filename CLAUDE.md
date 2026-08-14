# CLAUDE.md — Fixer Nation (fixernation.org)

**Primary domain:** fixernation.org  
**Stack:** Next.js 15 (Pages Router) · TypeScript · Tailwind CSS · Prisma · next-auth v4 · Stripe · nodemailer (cPanel SMTP) · Cloudinary  
**Status:** Phase 5 complete, CRM Phase 1 deployed

This is a NEW project. It is NOT fixernationeducation.com (the FN Education Express/MariaDB app on s3074).

---

## Infrastructure

| Resource | Provider | Notes |
|---|---|---|
| Hosting | **Vercel** | Auto-deploys on push to `main` |
| Database | **Neon** | PostgreSQL; connection string in Vercel env vars |
| Images | **Cloudinary** | Used for uploads |
| Email | cPanel SMTP (nodemailer) | fixernation.org hosting mailboxes |
| GitHub | https://github.com/ooWOWZERoo/fixernationorg | |

---

## Deploy process

**Push to `main` → Vercel deploys automatically.** That's it.

```bash
git push origin main
```

Vercel runs `npm run build` (which runs `prisma generate && next build`), then serves the app. No manual steps needed.

### Database migrations

Vercel does not run `prisma migrate deploy` automatically. After a schema change, run migrations manually from the Neon console or via a one-off command:

```bash
DATABASE_URL=<neon-url> npx prisma migrate deploy
```

Or set up a Vercel build command that includes it: `prisma migrate deploy && prisma generate && next build`.

### Environment variables

Set in **Vercel project settings → Environment Variables**:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Neon PostgreSQL connection string |
| `AUTH_SECRET` | ✅ | Min 32 chars — `openssl rand -base64 32` |
| `NEXTAUTH_URL` | ✅ | `https://fixernation.org` |
| `CRON_SECRET` | ✅ | Protects `/api/cron` endpoint |
| `SMTP_HOST` | ✅ | cPanel mail server |
| `SMTP_PORT` | ✅ | `587` |
| `SMTP_SECURE` | ✅ | `false` |
| `SMTP_USER` | ✅ | e.g. `noreply@fixernation.org` |
| `SMTP_PASS` | ✅ | Mailbox password |
| `SMTP_FROM` | ✅ | e.g. `noreply@fixernation.org` |
| `CLOUDINARY_CLOUD_NAME` | ✅ | |
| `CLOUDINARY_API_KEY` | ✅ | |
| `CLOUDINARY_API_SECRET` | ✅ | |
| `STRIPE_SECRET_KEY` | Phase | |
| `STRIPE_WEBHOOK_SECRET` | Phase | |
| `NEXT_PUBLIC_POSTHOG_KEY` | Phase | |
| `SENTRY_DSN` | Phase | |
| `DESIGN_PREVIEW_PASSWORD` | ✅ | Password for /design preview gate |

---

## Local dev commands

```bash
npm run dev          # Start dev server → http://localhost:3000
npm run build        # Production build (prisma generate + next build)
npm run type-check   # TypeScript check (no emit)
npm run lint         # ESLint
npm run db:generate  # Regenerate Prisma client after schema changes
npm run db:push      # Push schema to DB (dev only)
npm run db:migrate   # Apply pending migrations
npm run db:migrate:dev # Create + apply a new migration (dev)
npm run db:studio    # Prisma Studio GUI
```

---

## Project structure

```
src/
  pages/            Next.js Pages Router
    api/
      auth/         next-auth v4 routes
      admin/        Admin API routes (contacts, lists, campaigns, ...)
      public/       Public API routes (subscribe, unsubscribe)
      cron.ts       Cron jobs (morning-boost, campaign-scheduler)
      health.ts     Health check
      webhooks/     Stripe webhook handler
  components/
    layout/         SiteLayout, AdminLayout, SiteHeader, SiteFooter
    ui/             Button, Card, Input, Badge, Alert
  lib/
    auth.ts         next-auth v4 config
    db.ts           Prisma client singleton
    email.ts        nodemailer SMTP (all email delivery)
    env.ts          Zod-validated environment variables
    emails/         Email template builders (welcome, morning-boost, etc.)
prisma/
  schema.prisma     Database schema
  migrations/       SQL migration history
```

---

## Architecture

### Auth
next-auth v4 with `@next-auth/prisma-adapter`. Credentials provider (email + bcrypt). JWT sessions.

### Database
Prisma ORM on Neon PostgreSQL. `db:migrate:dev` locally, `prisma migrate deploy` for production.

### Email
All email (transactional + campaigns) via nodemailer over cPanel SMTP. No Postmark.

### Cron
Vercel Cron (or external caller) hits `POST /api/cron` with `Authorization: Bearer CRON_SECRET` and `{"job":"<name>"}`. Registered jobs: `morning-boost`, `campaign-scheduler`.

---

## Governing rules

1. The project owner retains all design, development, staging, production, and release authority.
2. Never promote to production without owner authorization.
3. Do not invent business rules. Flag conflicts or missing decisions.
4. All authorization and entitlement checks are enforced server-side.
5. All financial, consent, security, and admin actions must be auditable.
6. Do not add Fixer Nation Education content to this project.
7. Do not build Phase N+1 features during Phase N.
