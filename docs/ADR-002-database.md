# ADR-002: Database Engine Selection

**Date:** 2026-08-03  
**Status:** Pending cPanel validation (FN-S0-DB-001)  
**Deciders:** Project owner — must confirm after hosting inspection

## Context

Prisma supports PostgreSQL, MySQL, and SQLite. The Hosting.com shared hosting plan must be inspected to confirm what is available. The existing fixernationeducation.com project confirmed that the **STARTER** plan provides only MariaDB.

## Options

### Option A — PostgreSQL (preferred)
- First-class Prisma support
- Better enum handling, `JSONB` column type, UUID support
- More robust for concurrent workloads
- **Risk:** May not be available on shared hosting plan

### Option B — MySQL / MariaDB (fallback)
- Confirmed available on Hosting.com STARTER plan
- Prisma supports it fully
- Minor schema differences: `@db.Text` instead of `@db.Text` (compatible), no `JSONB`, `ENUM` handled differently
- Slightly less ergonomic for some query patterns

### Option C — SQLite (local dev only)
- Zero config for local development
- Not suitable for production on shared hosting

## Decision (pending)

- If PostgreSQL is available: use PostgreSQL. Update `prisma/schema.prisma` `provider = "postgresql"`.
- If only MySQL/MariaDB: use MySQL. Update `provider = "mysql"` and verify `@db.Text` / `@db.LongText` fields.
- Do **not** run `prisma migrate dev` until the provider is confirmed.

## Migration Path

For local development before cPanel is validated, use:
```
DATABASE_URL="postgresql://localhost:5432/fixernation"   # if PostgreSQL available locally
# OR
DATABASE_URL="mysql://localhost:3306/fixernation"         # if MariaDB available locally
```

SQLite is NOT recommended even for local dev given the schema differences with production.
