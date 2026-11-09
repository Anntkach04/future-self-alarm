#!/usr/bin/env bash
# Deploy voice API to Railway (HTTPS). Run from anywhere in the repo.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER="$ROOT/server"

if [ ! -f "$SERVER/assets/beds/bali-morning.m4a" ]; then
  echo "Missing music beds in server/assets/beds/ — need them in the image."
  exit 1
fi

if ! command -v railway >/dev/null 2>&1; then
  echo "Installing Railway CLI…"
  npm install -g @railway/cli
fi

if ! railway whoami >/dev/null 2>&1; then
  echo "Log in to Railway (browser will open)…"
  railway login
fi

cd "$SERVER"

# Never auto-create a new project — link to future-self-api first if needed.
if ! railway status >/dev/null 2>&1; then
  echo "No Railway project linked. Run from server/:"
  echo "  railway link   # pick future-self-api → production → api"
  exit 1
fi

echo "Setting secrets from repo .env (if present)…"
if [ -f "$ROOT/.env" ]; then
  # shellcheck disable=SC1090
  set -a
  # only export the keys the API needs
  ELEVENLABS_API_KEY="$(grep -E '^ELEVENLABS_API_KEY=' "$ROOT/.env" | head -1 | cut -d= -f2-)"
  OPENAI_API_KEY="$(grep -E '^OPENAI_API_KEY=' "$ROOT/.env" | head -1 | cut -d= -f2-)"
  ELEVENLABS_TTS_MODEL="$(grep -E '^ELEVENLABS_TTS_MODEL=' "$ROOT/.env" | head -1 | cut -d= -f2-)"
  OPENAI_MODEL="$(grep -E '^OPENAI_MODEL=' "$ROOT/.env" | head -1 | cut -d= -f2-)"
  OPENAI_MOOD_MODEL="$(grep -E '^OPENAI_MOOD_MODEL=' "$ROOT/.env" | head -1 | cut -d= -f2-)"
  set +a
  JWT_SECRET="$(grep -E '^JWT_SECRET=' "$ROOT/.env" | head -1 | cut -d= -f2-)"
  APPLE_CLIENT_ID="$(grep -E '^APPLE_CLIENT_ID=' "$ROOT/.env" | head -1 | cut -d= -f2-)"
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ROOT/.env" | head -1 | cut -d= -f2-)"
  if [ -z "${JWT_SECRET}" ]; then
    JWT_SECRET="$(openssl rand -hex 32)"
    echo "Generated JWT_SECRET for this deploy (also save it in .env)."
  fi
  railway variables set \
    NODE_ENV=production \
    "ELEVENLABS_API_KEY=${ELEVENLABS_API_KEY}" \
    "OPENAI_API_KEY=${OPENAI_API_KEY}" \
    "ELEVENLABS_TTS_MODEL=${ELEVENLABS_TTS_MODEL:-eleven_v4}" \
    "OPENAI_MODEL=${OPENAI_MODEL:-gpt-4o}" \
    "OPENAI_MOOD_MODEL=${OPENAI_MOOD_MODEL:-gpt-4o-mini}" \
    "JWT_SECRET=${JWT_SECRET}" \
    "APPLE_CLIENT_ID=${APPLE_CLIENT_ID:-com.futureself.alarm}"
  if [ -n "${DATABASE_URL}" ]; then
    railway variables set "DATABASE_URL=${DATABASE_URL}"
  fi
else
  echo "No .env found - set ELEVENLABS_API_KEY, OPENAI_API_KEY, JWT_SECRET in Railway dashboard."
fi

echo "Uploading server/ (includes beds) and deploying…"
railway up . --detach --path-as-root -y -s api

echo ""
echo "Waiting for public URL…"
sleep 3
railway domain 2>/dev/null || true
URL="$(railway variables --json 2>/dev/null | node -e "
let s=''; process.stdin.on('data',d=>s+=d); process.stdin.on('end',()=>{
  try {
    const j=JSON.parse(s);
    const u=j.RAILWAY_PUBLIC_DOMAIN || j.RAILWAY_STATIC_URL || '';
    if (u) console.log(u.startsWith('http')?u:'https://'+u);
  } catch {}
});
" || true)"

if [ -z "${URL}" ]; then
  URL="$(railway status 2>/dev/null | sed -n 's/.*https:\\/\\/[^ ]*/&/p' | head -1 || true)"
fi

echo ""
echo "Done (or nearly). Next:"
echo "  1) Open Railway → your service → Settings → Networking → Generate Domain"
echo "  2) Put that HTTPS URL in the app .env:"
echo "       EXPO_PUBLIC_API_URL=https://YOUR-SERVICE.up.railway.app"
echo "  3) curl -s https://YOUR-SERVICE.up.railway.app/api/health | jq"
echo "  4) Rebuild the iOS app so the new URL is baked in"
