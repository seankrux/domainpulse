#!/usr/bin/env bash
# Cloudflare Workers Build script.
# Vite 8 requires Node >= 20; CF Workers build agents default to Node 18.
# Tries three escalating strategies to get Node 22, then runs the build.
set -e

node_is_old() {
  # Returns 0 (true in shell) when Node < 20
  node -e "process.exit(parseInt(process.version.slice(1)) < 20 ? 0 : 1)" 2>/dev/null
}

# --- strategy 1: nvm ---
NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
  nvm install 22 --no-progress 2>/dev/null || true
  nvm use 22 2>/dev/null || true
fi

# --- strategy 2: n package manager ---
if node_is_old; then
  echo "Node $(node --version) < 20, trying n..."
  export N_PREFIX="$HOME/.n"
  npm install -g n --no-progress 2>/dev/null || true
  "$HOME/.n/bin/n" 22 2>/dev/null || true
  export PATH="$HOME/.n/bin:$PATH"
fi

# --- strategy 3: download Node 22 directly ---
if node_is_old; then
  echo "Node $(node --version) < 20, downloading Node 22 from nodejs.org..."
  ARCH=$(uname -m)
  [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ] && NODE_ARCH="arm64" || NODE_ARCH="x64"
  NODE_VER="22.15.1"
  NODE_DIR="$HOME/.node22"
  mkdir -p "$NODE_DIR"
  curl -fsSL "https://nodejs.org/dist/v${NODE_VER}/node-v${NODE_VER}-linux-${NODE_ARCH}.tar.gz" \
    | tar -xz -C "$NODE_DIR" --strip-components=1
  export PATH="$NODE_DIR/bin:$PATH"
fi

echo "Node: $(node --version)"

npm ci --legacy-peer-deps
npm run build:app
