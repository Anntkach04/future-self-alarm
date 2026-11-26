"""Generate music beds (Eleven Music) and ambient sounds (Sound Effects) for the app.

Usage (from the repo root):
  set -a; . ./.env; set +a
  python3 scripts/generate-sounds.py server/assets/beds music   # or: sounds
Reads ELEVENLABS_API_KEY from the environment. Writes <id>.mp3 into out_dir.
"""
import json
import os
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

KEY = os.environ["ELEVENLABS_API_KEY"]
OUT = sys.argv[1]
KIND = sys.argv[2]

MUSIC = {
    "music-soft-morning": "Very soft, warm instrumental morning ambience: gentle sustained synth pads and a slow, quiet fingerpicked nylon guitar, 70 bpm, peaceful and hopeful, no drums, no vocals, steady, made to sit quietly under a spoken voice",
    "music-sunrise": "Calm uplifting sunrise instrumental: soft handpan melody over airy pads, light shaker, gentle and optimistic, 80 bpm, no vocals, steady dynamics, background music under speech",
    "music-ocean-calm": "Slow ambient instrumental: wide warm pads, soft felt piano notes far in the background, very spacious and calm, not sad, no drums, no vocals, steady low dynamics for under a spoken voice",
    "music-lofi-morning": "Mellow lo-fi morning instrumental: soft dusty drum groove, warm electric piano chords, gentle bass, cosy and bright, 75 bpm, no vocals, steady background under speech",
}

SOUNDS = {
    "sound-birds": "Gentle early morning birdsong in a quiet garden, a few small songbirds chirping softly at a distance, calm, no people, no traffic, continuous",
    "sound-waves": "Soft calm ocean waves rolling slowly onto a sandy beach at dawn, gentle and steady, no wind gusts, no people, continuous",
    "sound-rain": "Light gentle rain falling steadily on leaves and a window, soft and cosy, no thunder, continuous",
}


def post(url, body):
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        headers={"xi-api-key": KEY, "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=300) as resp:
        return resp.read()


def make(item):
    sid, prompt = item
    try:
        if KIND == "music":
            data = post(
                "https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128",
                {
                    "prompt": prompt,
                    "music_length_ms": 30000,
                    "model_id": "music_v1",
                    "force_instrumental": True,
                },
            )
        else:
            data = post(
                "https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128",
                {
                    "text": prompt,
                    "duration_seconds": 30,
                    "prompt_influence": 0.5,
                    "loop": True,
                },
            )
    except urllib.error.HTTPError as e:
        return f"{sid}: HTTP {e.code} {e.read()[:300]!r}"
    except Exception as e:  # noqa: BLE001
        return f"{sid}: {e}"
    if data[:1] == b"{":
        return f"{sid}: unexpected JSON {data[:300]!r}"
    with open(os.path.join(OUT, f"{sid}.mp3"), "wb") as f:
        f.write(data)
    return f"{sid}: ok {len(data)} bytes"


items = MUSIC if KIND == "music" else SOUNDS
with ThreadPoolExecutor(max_workers=4) as pool:
    for line in pool.map(make, items.items()):
        print(line)
