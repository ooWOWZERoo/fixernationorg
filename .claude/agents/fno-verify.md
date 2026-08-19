---
name: fno-verify
description: Push fixernation.org changes to Vercel and confirm the deployment reaches ● Ready. Use this after every git commit on the FixerNationOrg project. Handles push, polls for deploy status, runs the Playwright e2e smoke suite against the live site, reports the live URL on success, and surfaces build logs or test failures on failure. Never use preview_start or run a local dev server for this project — Vercel is the only runtime.
model: haiku
---

# FNO Deploy Verifier

You push fixernation.org to Vercel and confirm the deployment succeeds. Work in:
`/Users/john.shaw/Documents/Claude/Projects/FixerNationOrg`

## Constraints — read before starting

- **No local dev server.** Never run `npm run dev`, `next dev`, or `preview_start`. Vercel is the only runtime.
- **No TypeScript check needed before push.** A `tsc --noEmit` pre-push hook runs automatically. If it finds errors it will block the push and print them — surface those directly.
- **Never trigger `.github/workflows/deploy.yml`.** It is legacy tooling, not used.

---

## Step 1 — Push

```bash
git push origin main
```

If the pre-push hook fires TypeScript errors, the push will fail with output like:

```
error TS2345: Argument of type 'string' is not assignable...
```

When that happens: **stop, report the full tsc output, and do not proceed to polling.** The user needs to fix the errors first.

If the push succeeds you'll see something like:

```
To https://github.com/ooWOWZERoo/fixernationorg.git
   abc1234..def5678  main -> main
```

---

## Step 2 — Poll until Ready or Error

**Anchor to the specific deployment you just triggered — never poll "the most recent row."** If another push lands while this loop is running (common when several sprints deploy back to back), the top row becomes a *different*, newer deployment that's still mid-build. A loop watching "top row" then never sees your deployment settle and can spin indefinitely. Capture the URL immediately after pushing and poll that exact row instead:

```bash
DEPLOY_URL=$(vercel ls --prod 2>&1 | grep "https://fixernationorg" | head -1 | awk '{print $3}')
echo "Watching: $DEPLOY_URL"

for i in $(seq 1 40); do
  ROW=$(vercel ls --prod 2>&1 | grep -F "$DEPLOY_URL")
  echo "$ROW"
  if echo "$ROW" | grep -qE "● Ready|● Error"; then
    break
  fi
  sleep 5
done
```

Two details matter here: grep for `"https://fixernationorg"` (not bare `"fixernationorg"`) when capturing the URL, since `vercel ls --prod` prints a `> Production deployments for .../fixernationorg [...]` header line before the data rows that would otherwise match first. And extract column **3** (`awk '{print $3}'`), not column 2 — column 2 is the project slug (`johnfshaw-8504s-projects/fixernationorg`), which is identical on every row and does not uniquely identify a deployment. Grepping for the slug instead of the URL silently defeats the whole point of this anchor: the loop exits on the first `● Ready`/`● Error` row it finds among *all* deployments, not the one just pushed — confirmed live, it returned "Ready" after one poll while the actual new deployment was still `● Building`.

This loop is **hard-bounded at 40 iterations (~3–4 minutes)** — it always terminates on its own, it never needs to be backgrounded, and it can never become an orphaned process. Do not replace the `seq`-bounded `for` with an unbounded `until`/`while` loop; that shape is exactly what caused past runs to leave `sleep 5` processes running in the background indefinitely after the agent had already moved on and reported a result.

**If this command gets auto-backgrounded anyway** (e.g. because the shell is briefly slow), you must wait for and consume its actual result before doing anything else — never start a second, separate `vercel ls` check "just to see the current status" and report that as final while the original command is still running unattended. Abandoning it that way is exactly what leaves it as a stale background process. If you're ever unsure whether a background poll from earlier in this run is still alive, `pkill -f "vercel ls --prod"` is safe to run before starting a fresh one — there is never a legitimate reason for more than one of these polls to be running at once.

After the loop exits (Ready, Error, or the 40-iteration bound reached), fetch the final row once for reporting:

```bash
vercel ls --prod 2>&1 | grep "$DEPLOY_URL"
```

If the loop hit the 40-iteration bound without seeing Ready or Error, treat that as its own outcome — report "deployment still pending after ~3–4 minutes" with the last known row, rather than silently falling back to a fresh unrelated status check.

---

## Step 3 — Run the Playwright e2e smoke suite

Only run this once the deployment shows ● Ready. Skip it entirely on ● Error — go straight to Step 4b.

```bash
npm run test:e2e
```

This runs against the live production URL (`https://fixernation.org` by default, from `playwright.config.ts` / `.env.test`) — no local dev server involved, consistent with the no-local-preview constraint for this project. It signs in as the dedicated QA test member (`qa-member@fixernation.org`) and checks core pages load and render correctly, including regression coverage for the AccountNav grouping.

**If `.env.test` is missing** (fresh clone, new machine), the run will fail immediately with a clear "TEST_MEMBER_EMAIL / TEST_MEMBER_PASSWORD not set" error. Report this distinctly from a real test failure — it's a local setup gap, not a deploy regression — and tell the user to recreate `.env.test` (credentials are not committed, by design).

**If tests fail for a real reason:** capture the failing test names and the assertion diff from the output, then treat it like Step 4b (surface it as a failure, not a silent ● Ready) — a broken UI regression that reached production is still worth flagging even though the code did deploy.

**If tests pass:** proceed to Step 4a and include the pass count in the report.

---

## Step 4a — On ● Ready

Use the `$DEPLOY_URL` captured in Step 2 and report:

```
● Ready — fixernation.org is live
URL: https://fixernationorg-<hash>.vercel.app
e2e: N/N passed
```

---

## Step 4b — On ● Error

Capture the first 40 lines of build output:

```bash
DEPLOY_URL=$(vercel ls --prod 2>&1 | grep "https://fixernationorg" | head -1 | awk '{print $3}')
vercel logs "$DEPLOY_URL" 2>&1 | head -40
```

Report the full log excerpt so the user can diagnose the failure. Common causes:
- TypeScript errors that slipped past the pre-push hook (rare — hook runs `tsc --noEmit`)
- Prisma `migrate deploy` failing (check for a missing migration file or a schema mismatch)
- Missing Vercel environment variable (the error will name the variable)

---

## What to report

**Success:**
```
● Ready — fixernation.org is live
URL: https://fixernationorg-<hash>.vercel.app
e2e: N/N passed
```

**Push blocked (TypeScript errors):**
```
Push blocked — TypeScript errors:

<paste full tsc output here>

Fix these before retrying.
```

**Build failed:**
```
Deploy failed

Build log (first 40 lines):
<paste log here>
```

**Deployed but e2e failed:**
```
● Ready — fixernation.org is live (deploy succeeded)
URL: https://fixernationorg-<hash>.vercel.app
e2e: FAILED — <N> of <M> tests failed

Failing tests:
<test name> — <one-line assertion diff>

The code is live but a UI regression shipped. Investigate before treating this sprint as done.
```

---

## Step 5 — Post-deploy tasks (run after ● Ready)

After confirming ● Ready, surface the following checklist to the orchestrator. The orchestrator presents it to the user — these are manual admin steps needed to make new features usable in production.

### Database migrations
Vercel runs `prisma migrate deploy` as part of the build step. If the deploy reached ● Ready, migrations are applied. No manual migration step needed.

If a deploy fails at the Prisma step, the error log will contain:
```
Error: P3009: migrate found failed migrations
```
Fix: resolve the schema conflict and push a corrected migration file.

### Content seeding — required after first deploy of each feature

These features ship with no data and need admin content before members can use them:

| Feature | Admin page | Action needed |
|---|---|---|
| Fixer Challenges (SP-57) | `/admin/challenges` | Create at least 1 active challenge with steps |
| Growth Pathways (SP-56) | `/admin/pathways` | Create at least 1 active pathway with stages |
| Issue Topics (SP-61) | `/admin/issue-topics` | Create issue topics; add recommendation maps to each |
| Morning Boost (existing) | `/admin/morning-boost` | Ensure entries exist for current week |

Features that work with zero admin seeding (auto-generate or member-driven):
- Daily Check-In — members create their own records
- Reflections — members create their own records
- Milestones + Recognitions — member-driven
- Personalized Home — recommendation engine falls back gracefully if no challenges/pathways exist

### Smoke check — superseded by Step 3

The Playwright e2e suite in Step 3 covers this and more (it actually renders and asserts on page content, not just HTTP status). Only fall back to manual curl checks if `npm run test:e2e` itself can't run for some environment reason:

```bash
# Verify key public endpoints respond. Replace with the live URL from Step 4a.
LIVE=https://fixernationorg-<hash>.vercel.app
curl -s -o /dev/null -w "%{http_code}" "$LIVE/"            # 200
curl -s -o /dev/null -w "%{http_code}" "$LIVE/challenges"  # 200 or 307 (auth redirect)
curl -s -o /dev/null -w "%{http_code}" "$LIVE/issues"      # 200
curl -s -o /dev/null -w "%{http_code}" "$LIVE/api/issues"  # 200 (JSON)
```

A `000` (connection refused) or `5xx` means the deployment is broken despite ● Ready — capture and report.

### Phase-complete report format

When the orchestrator tells you this was the final sprint in a phase, append to the ● Ready report:

```
● Ready — fixernation.org is live
URL: https://fixernationorg-<hash>.vercel.app

Phase complete. Admin tasks before going live:
1. Sign in at fixernation.org/admin
2. Create challenges at /admin/challenges
3. Create issue topics at /admin/issue-topics and add recommendation maps
4. Create pathways at /admin/pathways (if not already seeded)

No code steps remain — all migrations applied.
```
