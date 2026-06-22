#!/usr/bin/env bash
# Cloudflare Workers Build script.
# Activates Node 22 via nvm if available, then runs the Vite build.
# Vite 8 requires Node >= 20; CF Workers build agents default to Node 18.
set -e

# Try to activate nvm and switch to Node 22
NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
  nvm install 22 --no-progress 2>/dev/null || true
  nvm use 22 2>/dev/null || true
fi

echo "Node: $(node --version)"

npm ci --legacy-peer-deps
npm run build:app
