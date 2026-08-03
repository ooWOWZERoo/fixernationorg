# Deployment Procedure

## Environments

| Environment | Branch | Domain | Access |
|---|---|---|---|
| Development | `develop` | localhost:3000 | Developer only |
| Staging | `staging` | staging.fixernation.org (TBD) | Owner + team |
| Production | `main` | fixernation.org | Public — owner-authorized only |

## Local Development

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_ORG/fixernation-org.git
cd fixernation-org

# 2. Install dependencies
npm install

# 3. Copy env and fill in values
cp .env.example .env.local
# Edit .env.local with real LOCAL values

# 4. Set up the database (requires PostgreSQL or MySQL running locally)
npm run db:push        # push schema without migration history (dev only)
# OR
npm run db:migrate:dev # create/apply migrations

# 5. Start the dev server
npm run dev
# → http://localhost:3000
```

## cPanel Deployment (Staging or Production)

### First-time setup on cPanel

1. Clone the repo in cPanel Terminal:
   ```bash
   cd ~/repositories
   git clone https://github.com/YOUR_ORG/fixernation-org.git fixernation-org
   ```

2. In cPanel → Setup Node.js App:
   - Node.js version: 20 (or latest available ≥ 20)
   - Application mode: Production
   - Application root: `repositories/fixernation-org`
   - Application URL: `fixernation.org` (or subdomain for staging)
   - Application startup file: `.next/standalone/server.js`

3. Set environment variables in cPanel → Setup Node.js App → Environment Variables.
   Copy all values from `.env.example` and fill in real production values.

4. Activate the nodevenv and install:
   ```bash
   source ~/nodevenv/repositories/fixernation-org/20/bin/activate
   cd ~/repositories/fixernation-org
   npm ci
   npm run build
   npm run db:migrate
   ```

5. Start the app in cPanel → Setup Node.js App → Start.

6. Sync static files to `public_html`:
   ```bash
   rsync -av --delete \
     --exclude='.git' \
     --exclude='.gitignore' \
     --exclude='*.md' \
     --exclude='node_modules' \
     --exclude='.next' \
     --exclude='uploads' \
     ~/repositories/fixernation-org/public/ \
     ~/public_html/
   ```

### Routine deployments

```bash
# In cPanel Terminal — always use this exact sequence:
source ~/nodevenv/repositories/fixernation-org/20/bin/activate && \
  cd ~/repositories/fixernation-org && \
  git pull origin main && \
  npm ci && \
  npm run build && \
  npm run db:migrate
# Then: cPanel → Setup Node.js App → Restart
```

**Note:** `npm ci` is required after any `package.json` change (new dependencies).  
Restart is required after ANY server-side change — Next.js does not hot-reload in production.

### Static files

The Next.js standalone output serves static files internally, but if you configure cPanel to serve `_next/static` directly from `public_html` for performance:
```bash
rsync -av --delete \
  .next/static/ \
  ~/public_html/_next/static/
```

## Rollback

1. In cPanel Terminal:
   ```bash
   source ~/nodevenv/repositories/fixernation-org/20/bin/activate && \
     cd ~/repositories/fixernation-org && \
     git checkout <previous-sha> && \
     npm ci && \
     npm run build
   # Restart in cPanel
   ```
2. If a migration must be reversed, run the manual rollback SQL in cPanel Terminal → mysql CLI.

## Health Check

After any deployment, verify:
```bash
curl https://fixernation.org/api/health
# Expected: { "status": "ok", "checks": { "database": "ok" } }
```
