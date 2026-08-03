# Hosting Validation Checklist — FN-S0-HOST-001

Run each check on the Hosting.com cPanel environment before finalizing architecture.

## 1. Node.js Runtime

- [x] Confirm available Node.js versions (need ≥ 20 for Next.js 15) — **Node 24.18 confirmed**
- [x] Confirm `node --version` and `npm --version` in cPanel Terminal after activating nodevenv — **24.18 / npm bundled**
- [ ] Confirm max process memory limit
- [x] Confirm whether `output: "standalone"` + `node .next/standalone/server.js` works under Passenger/LiteSpeed — **deployed successfully via GitHub Actions rsync; pending live verification (DNS)**
- [x] Record: Application root path in cPanel "Setup Node.js App" — **`repositories/fixernationorg`**
- [x] Record: Application URL that will map to the Node.js process — **`fixernation.org`**

## 2. Database

- [x] Open cPanel → MySQL Databases — is PostgreSQL listed anywhere? — **YES — PostgreSQL available**
- [x] Create a test database and run `prisma db push` — **`fixernat_fixernationorg` created; schema in sync**
- [ ] Confirm max connections and connection pool compatibility
- [x] **Decision:** Provider is `postgresql` ✓

## 3. Cron Jobs

- [ ] Confirm cPanel Cron Jobs supports HTTP GET requests (or shell commands)
- [ ] Set up a test cron: `curl -s "https://fixernation.org/api/cron?job=health-check&token=CRON_SECRET"`
- [ ] Verify job records a row in `CronJob` table after execution
- [ ] Verify missed-run warning appears in logs when gap > 25 hours

## 4. File Storage

- [x] Confirm `~/public_html` is not wiped on deployment — **`~/public_html` and `~/repositories/fixernationorg` are separate; rsync `--delete` only touches `.next/standalone/`, not `public_html`**
- [x] Confirm where user-uploaded files should live — **`~/uploads/` (outside repo and public_html); rsync won't touch it**
- [ ] Confirm private file serving via signed URL or internal redirect (for Phase 1 protected content)
- [x] Confirm rsync `--delete` scope — **safe; scoped to `repositories/fixernationorg/.next/standalone/` only**

## 5. SSL and Domains

- [ ] Confirm SSL certificate is issued for `fixernation.org` and `www.fixernation.org`
- [ ] Confirm auto-redirect HTTP → HTTPS is in place (or document how to set it up via `.htaccess`)
- [x] Record cPanel server hostname — **`s16388.use1.stableserver.net`**

## 6. Subdomains

- [x] Confirm subdomains can be created — **Domains/Subdomains tool available in cPanel ✓**
- [ ] Confirm separate Node.js app can run on a subdomain — **not yet tested; needed for staging**

## 7. Email

- [ ] Confirm outbound SMTP is not blocked (port 587 / 465)
- [ ] Confirm Postmark API delivery works (direct API, not SMTP relay)
- [ ] Test a Postmark delivery in test mode

## 8. Environment Variables

- [x] Confirm `.env` file is not web-accessible — **env vars set in cPanel UI, no `.env` in repo**
- [x] Confirm Node process reads env vars correctly — **set in Setup Node.js App, confirmed working**
- [x] Confirm dotenv path issue not a problem — **not using dotenv; using cPanel env var injection**

## 9. Backup

- [x] Confirm backup setup — **automated backup configured: daily (00:00 every day, `00 00 * * *`), 7 rotations (~1 week history), local, compressed, full**
- [ ] Confirm database backup procedure — defer to Phase 1
- [ ] Test a restore from backup in staging — defer to Phase 1

## 10. Deployment Proof *(requires DNS)*

- [x] Deploy pipeline proven — **GitHub Actions → rsync → cPanel; first run successful**
- [ ] Confirm `GET /api/health` returns `{ status: "ok" }`
- [ ] Confirm `GET /api/cron?job=health-check&token=...` creates a `CronJob` row
- [ ] Confirm `/signin` page loads correctly
- [ ] Confirm `/design` redirects to `/design/unlock` before password is set
- [ ] Confirm Auth.js sign-in flow works end-to-end

## Findings so far

```
Node.js version: 24.18
PostgreSQL available: YES
Database engine selected: PostgreSQL
DB name: fixernat_fixernationorg
DB user: fixernat_fnapp
Schema status: in sync (prisma db push confirmed)
Passenger/standalone compatible: PENDING (deployed; DNS propagating)
cPanel server: s16388.use1.stableserver.net
cPanel user: fixernat
App root: ~/repositories/fixernationorg
Startup file: .next/standalone/server.js
CI/CD: GitHub Actions → rsync → cPanel SSH ✓
```
