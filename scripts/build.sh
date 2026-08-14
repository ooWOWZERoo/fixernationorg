#!/bin/sh
set -e

# Neon uses PgBouncer for the pooled DATABASE_URL, which doesn't support
# session-level advisory locks required by prisma migrate deploy.
# Derive a direct (non-pooled) URL by removing -pooler from the hostname.
DIRECT_URL=$(echo "$DATABASE_URL" | python3 -c "
import sys
u = sys.stdin.read().strip()
print(u.replace('-pooler.', '.'))
")
export DIRECT_URL

npx prisma migrate deploy
npx prisma generate
npx next build
