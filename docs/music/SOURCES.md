# Music & sounds under the wake voice

## Current (Nov 2026)

Generated with **ElevenLabs** on our paid plan. Paid-plan output may be used
commercially without attribution, including in an app; it may not be resold
as a sound library. Terms checked 2026-11-26:
- https://elevenlabs.io/eleven-music-model-specific-terms
- https://elevenlabs.io/sound-effects-terms
- https://elevenlabs.io/docs/help-center/legal/can-i-publish-the-content-i-generate-on-the-platform

| ID | File | Label in app | Made with | Prompt (short) |
|---|---|---|---|---|
| `sound-birds` | `sound-birds.mp3` | Birds | Sound Effects, 30 s loop | gentle early morning birdsong, quiet garden |
| `sound-waves` | `sound-waves.mp3` | Waves | Sound Effects, 30 s loop | soft calm ocean waves at dawn |
| `sound-rain` | `sound-rain.mp3` | Rain | Sound Effects, 30 s loop | light gentle rain on leaves and a window |
| `sound-bowl` | `sound-bowl.mp3` | Singing bowl | Sound Effects, 30 s loop | soft Tibetan singing bowl, yoga studio |
| `sound-stream` | `sound-stream.mp3` | Forest stream | Sound Effects, 30 s loop | small forest stream over stones |
| `sound-chimes` | `sound-chimes.mp3` | Wind chimes | Sound Effects, 30 s loop | bamboo/metal chimes, tropical terrace |
| `sound-forest` | `sound-forest.mp3` | Jungle sunrise | Sound Effects, 30 s loop | calm tropical forest at sunrise |
| `music-*` | `music-*.mp3` | Soft morning, Sunrise, Ocean calm, Lo-fi morning | Eleven Music (pending) | needs `music_generation` permission on the API key |

Generator: `scripts/generate-sounds.py` (prompts live there). To make the music tracks, enable `music_generation` on the ElevenLabs API key, then run it with `music`.
All sound files are levelled to about -26 LUFS (the mix expects that).
Files are committed to git (see `.gitignore` exceptions) so every deploy has them.

## Music beds back in the app (Nov 28 2026, CC0)

Re-downloaded with `server/scripts/download-beds.sh` sources, cut to 3 min with fades, levelled to -19 LUFS (like soft-calm). Committed to git.

| ID | Label | Source | Licence |
|---|---|---|---|
| `bali-morning` | Bali morning | Sunset Plains (Yoiyami) | CC0 |
| `yoga-air` | Yoga air | Up in the Sky (Memoraphile) | CC0 |
| `warm-earth` | Warm earth | Greens are good for you! (Pro Sensory) | CC0 |

## Default music: `soft-calm.m4a` (CC0)

Checked 2026-11-26: its decoded audio is identical to `soft-massage.m4a`,
i.e. **Calm Ambient 1** by Cynic Project, CC0
(https://opengameart.org/content/calm-ambient-1-synthwave-4k). Not in git
(large file); copy it into `server/assets/beds/` before deploying.

`morning-birds.mp3` (old birdsong, source unknown) is no longer used: the
generated `sound-birds.mp3` replaces it.

## History (Aug 2026, retired)

# Music beds — Bali / yoga / massage / morning

Vibe: **suuuper calm** — тихо, тепло, spa. Під голосом ледь чутно. **Not** upbeat indie loops. **Not** sad cinematic piano.

All five slots are **CC0** — no attribution required in the app.

Files live in `server/assets/beds/`. Screenshot each licence page the day you download.

## Installed beds (Aug 2026)

| Slot ID | File | Chip in app | Source | Licence |
|---|---|---|---|---|
| `bali-morning` | `bali-morning.m4a` | Bali morning | **Sunset Plains** (Yoiyami) | CC0 |
| `yoga-air` | `yoga-air.m4a` | Yoga air | **Up in the Sky** (Memoraphile) | CC0 |
| `soft-massage` | `soft-massage.m4a` | Soft massage | **Calm Ambient 1** / Synthwave 4k (Cynic Project) | CC0 |
| `light-water` | `light-water.m4a` | Light water | **Within The Abandoned Castle V2** (Spring) | CC0 |
| `warm-earth` | `warm-earth.m4a` | Warm earth | **Greens are good for you!** (Pro Sensory) | CC0 |

## Download pages

- Sunset Plains: https://opengameart.org/content/sunset-plains
- Up in the Sky: https://opengameart.org/content/up-in-the-sky
- Calm Ambient 1: https://opengameart.org/content/calm-ambient-1-synthwave-4k
- Within The Abandoned Castle: https://opengameart.org/content/within-the-abandoned-castle
- Greens are good for you: https://opengameart.org/content/greens-are-good-for-you

Re-download all beds:

```bash
cd server && npm run beds:download
```

Convert WAV/OGG → M4A if needed (`afconvert -f m4af -d aac input.wav output.m4a`).

## Credits in the app

**Music: not required.** All beds are CC0 public domain.

ElevenLabs credit in Menu is optional (paid API / transparency), not a music licence rule.

## How to listen

Play as background while someone talks softly. If the music pulls focus or feels cheerful — skip it. If it could play in a silent Bali shala at 7am — keep it.

## If nothing here feels beautiful enough

Commission five original beds (handpan / soft guitar / pads). Contract: work-for-hire, you own copyright, mix/loop/ship in a mobile alarm app.

Epidemic Sound stays on YouTube until they give a written **app** licence.
