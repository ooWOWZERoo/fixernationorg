# Hosting Validation Checklist — FN-S0-HOST-001

Run each check on the Hosting.com cPanel environment before finalizing architecture.

## 1. Node.js Runtime

- [ ] Confirm available Node.js versions (need ≥ 20 for Next.js 15)
- [ ] Confirm `node --version` and `npm --version` in cPanel Terminal after activating nodevenv
- [ ] Confirm max process memory limit
- [ ] Confirm whether `output: "standalone"` + `node .next/standalone/server.js` works under Passenger/LiteSpeed
- [ ] Record: Application root path in cPanel "Setup Node.js App"
- [ ] Record: Application URL that will map to the Node.js process

## 2. Database

- [ ] Open cPanel → MySQL Databases — is PostgreSQL listed anywhere?
- [ ] If PostgreSQL is unavailable: confirm MariaDB version (needs ≥ 10.6 for Prisma)
- [ ] Create a test database and run `prisma db push` (with `provider = "mysql"` if needed)
- [ ] Confirm max connections and connection pool compatibility
- [ ] **Decision required:** Update `prisma/schema.prisma` `provider` before any migrations are written

## 3. Cron Jobs

- [ ] Confirm cPanel Cron Jobs supports HTTP GET requests (or shell commands)
- [ ] Set up a test cron: `curl -s "https://fixernation.org/api/cron?job=health-check&token=CRON_SECRET"`
- [ ] Verify job records a row in `CronJob` table after execution
- [ ] Verify missed-run warning appears in logs when gap > 25 hours

## 4. File Storage

- [ ] Confirm `~/public_html` is not wiped on deployment
- [ ] Confirm where user-uploaded files should live (e.g., `~/uploads/` outside `public_html`)
- [ ] Confirm private file serving via signed URL or internal redirect (for Phase 1 protected content)
- [ ] Confirm whether `--delete` rsync excludes must explicitly protect uploads directory

## 5. SSL and Domains

- [ ] Confirm SSL certificate is issued for `fixernation.org` and `www.fixernation.org`
- [ ] Confirm auto-redirect HTTP → HTTPS is in place (or document how to set it up via `.htaccess`)
- [ ] Record the cPanel server hostname

## 6. Subdomains

- [ ] Confirm subdomains can be created (needed for `staging.fixernation.org`)
- [ ] Confirm separate Node.js app can run on a subdomain

## 7. Email

- [ ] Confirm outbound SMTP is not blocked (port 587 / 465)
- [ ] Confirm Postmark can deliver to Hosting.com SMTP relay, or that direct API is used
- [ ] Test a Postmark delivery in test mode

## 8. Environment Variables

- [ ] Confirm `.env` file is not web-accessible (outside `public_html`)
- [ ] Confirm Node process reads `.env` from the app root correctly
- [ ] Confirm `dotenv` config path must be explicit (known issue from FN Education project — Passenger sets `process.cwd()` incorrectly)

## 9. Backup

- [ ] Confirm Hosting.com automatic backup frequency
- [ ] Confirm database backup procedure (mysqldump / cPanel backup)
- [ ] Test a restore from backup in staging

## 10. Deployment Proof

- [ ] Run `git pull` + `npm ci` + `npm run build` + `npm run db:migrate` on staging
- [ ] Confirm `GET /api/health` returns `{ status: "ok" }`
- [ ] Confirm `GET /api/cron?job=health-check&token=...` creates a `CronJob` row
- [ ] Confirm `/signin` page loads correctly
- [ ] Confirm `/design` redirects to `/design/unlock` before password is set
- [ ] Confirm Auth.js sign-in flow works end-to-end

## Findings Report Template

After completing the above, fill in:

```
Node.js version available: __________
PostgreSQL available: YES / NO
Database engine selected: __________
Passenger/standalone compatible: YES / NO / UNKNOWN
Cron HTTP method: curl GET / shell command
File storage path: __________
SSL issued: YES / NO
Staging subdomain available: YES / NO
Phase 1 may proceed: YES / NO (reasons if NO)
```
