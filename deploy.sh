#!/usr/bin/env bash
# deploy.sh — build locally on your Mac, push to fixernation.org
#
# First-time setup (run once):
#   1. ssh-keygen -t ed25519 -f ~/.ssh/fixernation_deploy -N ""
#   2. cPanel → SSH/Shell Access → Manage SSH Keys → Import Key
#      (paste the full contents of ~/.ssh/fixernation_deploy.pub)
#   3. Click "Authorize" next to the imported key
#   4. Test: ssh -i ~/.ssh/fixernation_deploy fixernat@s16388.use1.stableserver.net exit
#
# Usage:
#   ./deploy.sh

set -euo pipefail

REMOTE="fixernat@s16388.use1.stableserver.net"
REMOTE_PATH="repositories/fixernationorg"
KEY="${DEPLOY_SSH_KEY_PATH:-$HOME/.ssh/fixernation_deploy}"
SSH_OPTS="-i $KEY -o StrictHostKeyChecking=yes -o BatchMode=yes"

if [[ ! -f "$KEY" ]]; then
  echo "ERROR: SSH key not found at $KEY"
  echo ""
  echo "Generate one:"
  echo "  ssh-keygen -t ed25519 -f $KEY -N \"\""
  echo ""
  echo "Then add the public key in:"
  echo "  cPanel → SSH/Shell Access → Manage SSH Keys → Import Key"
  exit 1
fi

echo "==> Building..."
npm run build

echo "==> Preparing standalone bundle..."
cp -r .next/static .next/standalone/.next/static
[[ -d public ]] && cp -r public .next/standalone/public || true

echo "==> Deploying standalone..."
rsync -az --delete \
  -e "ssh $SSH_OPTS" \
  .next/standalone/ \
  "$REMOTE:$REMOTE_PATH/.next/standalone/"

echo "==> Syncing prisma..."
rsync -az \
  -e "ssh $SSH_OPTS" \
  prisma/ \
  "$REMOTE:$REMOTE_PATH/prisma/"

echo ""
echo "==> Done. Restart the app to go live:"
echo "    cPanel → Setup Node.js App → Restart application"
echo ""
echo "==> Verify: curl https://fixernation.org/api/health"
