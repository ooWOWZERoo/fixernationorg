# ADR-001: Next.js App Router as the Application Framework

**Date:** 2026-08-03  
**Status:** Accepted  
**Deciders:** Project owner

## Context

The fixernation.org rebuild requires:
- Server-rendered public pages (SEO, fast first paint)
- Protected member content (server-enforced, not client-gated)
- API routes for Stripe webhooks, cron, and Auth.js
- A single deployable artifact for Hosting.com cPanel shared hosting
- TypeScript throughout

## Decision

Use **Next.js 15 with the App Router** and `output: "standalone"`.

## Rationale

| Criterion | Next.js App Router | Plain Express + React | Remix |
|---|---|---|---|
| SSR + RSC for protected routes | ✅ Native | ❌ Manual | ✅ |
| API routes in same codebase | ✅ | ✅ | ✅ |
| Standalone Node.js output for cPanel | ✅ `output: "standalone"` | ✅ | ⚠️ More setup |
| Auth.js support | ✅ First-class | ⚠️ Manual | ✅ |
| Prisma + RSC data fetching | ✅ | ✅ | ✅ |
| Ecosystem maturity | ✅ Largest | ✅ | ✅ Growing |

## Consequences

- **`output: "standalone"`** creates `.next/standalone/server.js` — run as a Node.js app on cPanel, replacing the old Express approach.
- The static assets in `.next/static` must be served from `public_html` via rsync (same pattern as FN Education).
- Middleware runs at the edge — if cPanel's Node.js integration does not support the middleware runtime, it falls back to the Node.js runtime automatically.
- Next.js 15 requires Node.js ≥ 20 — must be confirmed on cPanel during Stage 0.

## Alternatives Considered

- **Express + React SPA**: More familiar but loses SSR, requires more manual setup for RSC-style server enforcement.
- **Remix**: Viable alternative; Next.js chosen for larger ecosystem and Auth.js first-class support.
