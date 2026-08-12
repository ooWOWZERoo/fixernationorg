#!/usr/bin/env bash
# deploy.sh — run in cPanel Terminal AFTER the GitHub Actions build finishes

set -euo pipefail
cd "$(dirname "$0")"

PROJECT="fixernation.org"
EXPECTED_REMOTE="fixernationorg"

REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
if [[ "$REMOTE_URL" != *"$EXPECTED_REMOTE"* ]]; then
  echo "ERROR: Wrong project directory."
  echo "  Expected repo containing '$EXPECTED_REMOTE'"
  echo "  Got: $REMOTE_URL"
  exit 1
fi

echo ""
echo "========================================="
echo "  PROJECT: $PROJECT"
echo "  Build:   GitHub Actions (automatic)"
echo "  This step: migrations + restart"
echo "========================================="
echo ""
echo "  Wait for the GitHub Actions workflow to"
echo "  finish before answering yes below."
echo ""
read -p "Run migrations and go live? (y/N) " confirm
[[ "$confirm" == "y" || "$confirm" == "Y" ]] || { echo "Aborted."; exit 0; }

# Activate Node.js virtual environment
NODE_ENV_DIR="$HOME/nodevenv/repositories/fixernationorg"
NODE_ACTIVATE=$(ls "$NODE_ENV_DIR"/*/bin/activate 2>/dev/null | head -1)
if [[ -n "$NODE_ACTIVATE" ]]; then
  set +u
  source "$NODE_ACTIVATE"
  set -u
fi

echo "==> Ensuring Prisma CLI..."
if ! command -v prisma &> /dev/null; then
  NODE_OPTIONS="--max-old-space-size=128" npm install -g prisma --no-audit --no-fund
fi

echo "==> Running database migrations..."
prisma migrate deploy

echo ""
echo "==> Done. Restart the app to go live:"
echo "    cPanel → Setup Node.js App → Restart application"
echo ""
echo "==> Verify: curl https://fixernation.org/api/health"
