#!/usr/bin/env bash
# deploy.sh — run in cPanel Terminal after the GitHub Actions workflow goes green

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
echo "  Build + migrations: GitHub Actions"
echo "  This step: restart only"
echo "========================================="
echo ""
echo "  GitHub Actions handles the build, file"
echo "  deployment, and database migrations."
echo ""
echo "  Only continue once the workflow is green."
echo ""
read -p "Restart the app and go live? (y/N) " confirm
[[ "$confirm" == "y" || "$confirm" == "Y" ]] || { echo "Aborted."; exit 0; }

echo ""
echo "==> Restart the app to go live:"
echo "    cPanel → Setup Node.js App → Restart application"
echo ""
echo "==> Then verify: curl https://fixernation.org/api/health"
