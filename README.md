# Future Self Alarm

Wake up to **your own cloned voice** reading a short morning message, with quiet music underneath.

This is an Expo (React Native) app. GitHub shows the **code**, not the live iPhone app. To run it you need a Mac, Xcode, and a phone on the same Wi‑Fi as the API server — see `docs/TESTING.md`.

## What it does

- Onboarding: name, feelings, future-self chips, music bed, wake time, voice recording
- Clones the voice (ElevenLabs) and writes a morning script (OpenAI)
- Mixes a calm bed under the voice
- Schedules a notification that plays the full audio

## Stack

Expo 57 · React Native · Express API · ElevenLabs · OpenAI

## Privacy

Do not commit `.env`. Copy `.env.example` and add your own keys.
