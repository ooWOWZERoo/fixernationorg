#!/usr/bin/env bash
# deploy.sh — run in cPanel Terminal for fixernation.org

set -euo pipefail

cd "$(dirname "$0")"

PROJECT="fixernation.org"
EXPECTED_REMOTE="fixernationorg"

# Confirm we're in the right repo
REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
if [[ "$REMOTE_URL" != *"$EXPECTED_REMOTE"* ]]; then
  echo "ERROR: Wrong project directory."
  echo "  Expected a repo containing '$EXPECTED_REMOTE'"
  echo "  Got: $REMOTE_URL"
  exit 1
fi

echo ""
echo "========================================="
echo "  PROJECT: $PROJECT"
echo "  REMOTE:  $REMOTE_URL"
echo "  DIR:     $(pwd)"
echo "========================================="
echo ""
read -p "Deploy this project on this server? (y/N) " confirm
[[ "$confirm" == "y" || "$confirm" == "Y" ]] || { echo "Aborted."; exit 0; }

echo "==> Pulling latest code..."
git pull origin main

echo "==> Installing dependencies..."
npm ci

echo "==> Building..."
npm run build

echo "==> Preparing standalone bundle..."
cp -r .next/static .next/standalone/.next/static
[[ -d public ]] && cp -r public .next/standalone/public || true

echo "==> Running database migrations..."
npx prisma migrate deploy

echo ""
echo "==> Build complete. Restart the app to go live:"
echo "    cPanel → Setup Node.js App → Restart application"
echo ""
echo "==> Verify: curl https://fixernation.org/api/health"
