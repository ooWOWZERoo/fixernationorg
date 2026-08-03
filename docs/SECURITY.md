# Security Architecture

## Authentication

- **Auth.js v5** with Credentials provider (email + bcrypt password hash).
- Email verification required before any sign-in is permitted.
- Sessions use JWT strategy (required for Credentials provider).
- Super Administrator accounts require MFA (TOTP) — wired in Phase 1.
- Session tokens are signed with `AUTH_SECRET` (minimum 32-char random value).

## Authorization

- All entitlement and role checks are enforced **server-side** in Server Components and Route Handlers.
- Client-side UI may hide elements but is never the enforcement point.
- `UserRole` enum: `SUPER_ADMIN | ADMIN | MEMBER | CONSUMER | PROVIDER | AMBASSADOR`
- Protected routes: `/dashboard`, `/account`, `/admin` — middleware redirects unauthenticated requests.

## HTTP Security Headers

All routes respond with:
- `X-Frame-Options: DENY` — prevents clickjacking
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

## Stripe Webhooks

- Signature verified with `stripe.webhooks.constructEvent` before any processing.
- Raw body preserved via `req.text()` before any JSON parsing.
- Idempotency: Phase 1 will deduplicate by Stripe event ID.

## Cron Jobs

- Endpoint requires `?token=CRON_SECRET` in every request.
- `CRON_SECRET` is a random 32-char value, stored only in environment variables.
- Job locking prevents concurrent execution and detects stale locks.

## Secrets Management

- **Never commit** `.env` or any file containing real keys.
- `.env.example` documents all required variables with placeholder values.
- Production secrets are stored in GitHub Actions secrets (for CI builds) and in cPanel's environment variable configuration.
- Rotate `AUTH_SECRET` causes all active sessions to be invalidated.

## Audit Log

- All financial, consent, security, and admin actions must be auditable (Phase 1+).
- Audit log records must be immutable — no UPDATE or DELETE on audit rows.

## Data Retention

- Contact form records: 2-year retention (per FN-P1-CONTACT-001).
- Session tokens: expire per Auth.js configuration.

## Threat Model (Stage 0 scope)

| Threat | Mitigation |
|---|---|
| Unauthenticated access to protected routes | Middleware redirect; server-side auth check in every Server Component |
| Stripe webhook replay | Signature verification; Phase 1 dedup |
| Cron endpoint abuse | `CRON_SECRET` token; rate-limit via cPanel firewall |
| Design preview exposure | Cookie-based password gate; `DESIGN_PREVIEW_PASSWORD` |
| SQL injection | Prisma parameterized queries only |
| XSS | React/Next.js HTML escaping by default; no `dangerouslySetInnerHTML` |
| CSRF | Auth.js handles CSRF for its own endpoints; SameSite cookies |
