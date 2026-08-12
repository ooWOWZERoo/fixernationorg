#!/usr/bin/env bash
# deploy.sh
# Manual: run in cPanel Terminal after GitHub Actions goes green.
# CI:     called automatically by the workflow with CI=true.

set -euo pipefail
cd "$(dirname "$0")"

# ── Guard: make sure we're in the right project ────────────────────────────
EXPECTED_REMOTE="fixernationorg"
REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
if [[ "$REMOTE_URL" != *"$EXPECTED_REMOTE"* ]]; then
  echo "ERROR: Wrong project directory (expected repo containing '$EXPECTED_REMOTE')."
  exit 1
fi

# ── Interactive prompt (skip when CI=true or no TTY) ──────────────────────
if [[ "${CI:-}" != "true" ]] && [ -t 0 ]; then
  echo ""
  echo "========================================="
  echo "  PROJECT: fixernation.org"
  echo "  This step: restart only"
  echo "========================================="
  echo ""
  read -p "Restart the app and go live? (y/N) " confirm
  [[ "$confirm" == "y" || "$confirm" == "Y" ]] || { echo "Aborted."; exit 0; }
fi

# ── Restart: kill the process; Passenger (MinInstances 1) restarts it ─────
echo "Restarting app..."
pkill -f "fixernationorg/.next/standalone/server.js" || true
sleep 3
echo "Done."
