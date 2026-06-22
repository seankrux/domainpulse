#!/usr/bin/env bash
# Cloudflare Workers Build script.
# Vite 8 requires Node >= 20; CF Workers build agents default to Node 18.
# Strategy: nvm first, then `n` as fallback, then whatever is on PATH.
set -e

node_is_old() {
  # Returns 0 (true in shell) when Node < 20
  node -e "process.exit(parseInt(process.version.slice(1)) < 20 ? 0 : 1)" 2>/dev/null
}

# --- attempt 1: nvm ---
NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
  nvm install 22 --no-progress 2>/dev/null || true
  nvm use 22 2>/dev/null || true
fi

# --- attempt 2: n package manager ---
if node_is_old; then
  echo "Node $(node --version) < 20 — trying 'n' to upgrade..."
  export N_PREFIX="$HOME/.n"
  npm install -g n --no-progress --prefer-offline 2>/dev/null || true
  "$HOME/.n/bin/n" 22 2>/dev/null || true
  export PATH="$HOME/.n/bin:$PATH"
fi

echo "Node: $(node --version)"

npm ci --legacy-peer-deps
npm run build:app
