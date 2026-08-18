#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${VOICE_API_PORT:-8787}"

find_node() {
  if command -v node >/dev/null 2>&1; then
    command -v node
    return 0
  fi
  if [ -n "${NVM_DIR:-}" ] && [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck disable=SC1090
    . "$NVM_DIR/nvm.sh"
    if command -v node >/dev/null 2>&1; then
      command -v node
      return 0
    fi
  fi
  local candidate
  for candidate in \
    "$HOME/.nvm/versions/node/"*/bin/node \
    /opt/homebrew/bin/node \
    /usr/local/bin/node \
    "/Applications/Cursor.app/Contents/Resources/app/resources/helpers/node"
  do
    if [ -x "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

if ! NODE="$(find_node)"; then
  echo "Node.js not found."
  echo "Install Node (https://nodejs.org) or run: nvm install --lts"
  exit 1
fi

if curl -sf "http://localhost:${PORT}/api/health" >/dev/null 2>&1; then
  echo "Voice API already running at http://localhost:${PORT}"
  echo "Health: http://localhost:${PORT}/api/health"
  exit 0
fi

if lsof -nP -iTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port ${PORT} is busy but /api/health did not respond."
  echo "Stop the other process or set VOICE_API_PORT to another port in .env"
  lsof -nP -iTCP:"${PORT}" -sTCP:LISTEN || true
  exit 1
fi

if [ ! -d "$ROOT/server/node_modules" ]; then
  echo "Installing server dependencies…"
  NPM="$(dirname "$NODE")/npm"
  if [ ! -x "$NPM" ]; then NPM=npm; fi
  (cd "$ROOT/server" && "$NPM" install)
fi

echo "Starting voice API with: $NODE"
echo "Project: $ROOT"
echo ""
cd "$ROOT"
exec "$NODE" server/index.js
