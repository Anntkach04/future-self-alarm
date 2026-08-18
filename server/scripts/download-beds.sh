#!/usr/bin/env bash
# Re-fetch CC0/CC BY beds into server/assets/beds/
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BEDS="$ROOT/assets/beds"
TMP="$BEDS/_tmp"
mkdir -p "$TMP" "$BEDS"

echo "→ bali-morning (Sunset Plains) — skip if already happy with bali-morning.m4a"
curl -fsSL -o "$TMP/sunset_plains.wav" \
  "https://opengameart.org/sites/default/files/sunset_plains.wav" || true
if [[ -f "$TMP/sunset_plains.wav" ]]; then
  afconvert -f m4af -d aac "$TMP/sunset_plains.wav" "$BEDS/bali-morning.m4a"
fi

echo "→ yoga-air (Up in the Sky — dreamy pads, not guitar)"
curl -fsSL -o "$TMP/up_in_the_sky.ogg" \
  "https://opengameart.org/sites/default/files/Memoraphile%20-%20Up%20in%20the%20Sky.ogg"
afconvert -f m4af -d aac "$TMP/up_in_the_sky.ogg" "$BEDS/yoga-air.m4a"

echo "→ soft-massage (Calm Ambient 1)"
curl -fsSL -o "$TMP/synthwave_4k.mp3" \
  "https://opengameart.org/sites/default/files/001_Synthwave_4k.mp3"
afconvert -f m4af -d aac "$TMP/synthwave_4k.mp3" "$BEDS/soft-massage.m4a"

echo "→ light-water (Within The Abandoned Castle V2)"
curl -fsSL -o "$TMP/castle.ogg" \
  "https://opengameart.org/sites/default/files/within%20the%20abandoned%20castle%20V2.ogg"
afconvert -f m4af -d aac "$TMP/castle.ogg" "$BEDS/light-water.m4a"

echo "→ warm-earth (Greens are good for you — CC0, warm calm)"
curl -fsSL -o "$TMP/greens.wav" \
  "https://opengameart.org/sites/default/files/Greens%20are%20good%20for%20you.wav"
afconvert -f m4af -d aac "$TMP/greens.wav" "$BEDS/warm-earth.m4a"
rm -f "$BEDS/warm-earth.mp3"

rm -rf "$TMP"
rm -f "$BEDS/yoga-air.mp3" "$BEDS/soft-massage.mp3" "$BEDS/warm-earth.mp3"
echo "Done:"
ls -lh "$BEDS"
