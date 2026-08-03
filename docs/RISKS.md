# Risk Register — Stage 0

| ID | Risk | Probability | Impact | Mitigation | Status |
|---|---|---|---|---|---|
| R-01 | PostgreSQL unavailable on cPanel plan | High | Medium | MySQL/MariaDB fallback — Prisma supports both; schema differences are minor | Open — must validate |
| R-02 | Next.js standalone mode incompatible with Passenger/LiteSpeed on cPanel | Medium | High | Fall back to a custom Express wrapper around Next.js; or migrate to a VPS/managed Node host | Open — must validate |
| R-03 | cPanel overwriting `.next/` or `uploads/` on deployment | Medium | High | Strict rsync `--exclude` rules; document in DEPLOYMENT.md; never use `--delete-excluded` | Mitigated (pattern from FN Education) |
| R-04 | `process.cwd()` incorrect under Passenger — dotenv loads nothing | High | High | Already mitigated: env vars set in cPanel Setup Node.js App, not loaded via dotenv | Mitigated |
| R-05 | LiteSpeed proxy rejects POST with no Content-Type | High | Medium | All fetch calls must include `Content-Type: application/json` — enforced in client utils | Mitigated (pattern from FN Education) |
| R-06 | Stripe webhook body parsing fails in App Router | Low | High | Use `req.text()` before parsing; do not use `express.json()` middleware | Mitigated in scaffold |
| R-07 | Node.js version < 20 on cPanel | Low | High | FN Education project confirmed Node 24 available; verify for this host account | Low risk |
| R-08 | Shared hosting performance limits under member load | Medium | Medium | Phase 6 migration path to managed hosting is planned | Accepted — Phase 6 |
| R-09 | AUTH_SECRET rotation invalidates all active sessions | Low | Low | Communicate planned maintenance; rotate during off-peak hours | Accepted |
| R-10 | Cron endpoint publicly accessible without rate limiting | Medium | Low | `CRON_SECRET` token gates access; cPanel firewall can restrict to localhost | Partial — review at Phase 1 |

## Blockers for Phase 1

The following risks must be resolved before Phase 1 begins:
- R-01 (database engine must be selected)
- R-02 (Next.js standalone compatibility must be proven)
