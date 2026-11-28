#!/usr/bin/env bash
# Rebuild + install Release on a connected iPhone (voice wake sound fix).
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/opt/cmake/bin:/opt/homebrew/bin:${PATH:-}"

DEVICE="${1:-}"
if [[ -z "$DEVICE" ]]; then
  echo "Usage: $0 <device-udid>"
  echo "List devices: xcrun xctrace list devices"
  exit 1
fi

echo "Building Release for $DEVICE…"
npx expo run:ios --device "$DEVICE" --configuration Release --no-bundler
echo "Done. On the phone: reopen the app, create alarm again."
