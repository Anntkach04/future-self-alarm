# Alarm engine — pre-release checks

Target: iOS **26.1+** (`app.json` → `ios.deploymentTarget`). AlarmKit does not exist on iOS 25 and below; we require 26.1 rather than shipping a limited fallback OS.

Wake path for **cloned** voices: prefer **AlarmKit** (real system alarm UI + CAF in `Library/Sounds`) when authorized; else local **time-sensitive notifications** + CAF. Never schedule both for the same wake (double sound). Not Clock.app.

---

## 1. Custom voice audio (≤30s system limit)

| Layer | What plays | Limit |
|-------|------------|--------|
| Lock screen / notification sound | CAF from `installAlarmSystemSound` | **≤28s** encoded (`ALARM_WAKE_SOUND_MAX_SECONDS`) — Apple rejects >30s and plays default |
| App open / “I'm up” screen | Full MP3 via `expo-audio` | Full AI message |

Apple: [UNNotificationSound](https://developer.apple.com/documentation/usernotifications/unnotificationsound) — custom sounds must be under 30 seconds.

**Device test:** lock phone, let alarm fire, confirm voice CAF plays (not only default beep). Unlock/open app → full MP3 may continue.

---

### A new message every morning (no need to open the app)

iOS gives the app no guaranteed run at ring time, so messages are built ahead (`services/ringBank.ts`, `services/eveningRegen.ts`):

- Whenever the app is open, the next **7 rings** of each alarm are stocked with their own text + MP3 + CAF. Steady state is still one generation per ring.
- Each ring is its **own one-off AlarmKit alarm** (4 weeks ahead) with its own sound file. A weekly repeating alarm has one sound, so it said the same words every day.
- Rings past the stocked week reuse the stocked messages in turn: the app can stay closed for weeks and the words still change. Past 4 weeks nothing is scheduled until the app is opened again.
- Each build gets a **new CAF file name** (`fs_ring_*`), so the system can't replay a cached older sound.
- Today's mood rebuilds only the next ring, inside the 10 h window before it.

**Device test:** set a daily alarm, open the app once, wait for 7 `fs_ring_*.caf` files, then keep the app closed for 2–3 mornings → each morning's message is different.

---

## 2. I'm up

| Path | Behavior |
|------|----------|
| In-app **I'm up** | `dismissAlarm` → stop AV player, dismiss presented alerts, cancel **near-term** snooze chain, `AlarmKit.cancelAlarm` if any leftover Kit id |
| AlarmKit system Stop (if Kit used) | Native `AlarmDismissIntent` / `AlarmDismissIntentWithLaunch` in `expo-alarm-kit` |

Notification-path “I'm up” is **not** an App Intent — Intents only attach to AlarmKit alerts. It correctly stops *our* playback and further scheduled rings. iOS will not cut off a UNNotificationSound already mid-play.

**Device test:** while ringing, tap I'm up → no further rings at +10/+20 min.

---

## 3. 10-minute snooze (system-level)

Follow-ups are **pre-scheduled** as local notifications at save time (`SNOOZE_CHAIN` steps × `snoozeMinutes`, default 10). They fire with the app killed — not JS timers, not “schedule on receive”.

**Device test:** enable Keep waking me → force-quit app → let wake fire → do nothing → confirm another alert ~10 min later → I'm up → confirm no more that morning.

---

## 4. iOS 25 and below

**Decision:** minimum **iOS 26.1**. No limited mode for older OS. App Store will not offer the build on unsupported versions.

---

## 5. Fallback audio

Bundled `assets/sounds/fs_fallback.caf` registered in `expo-notifications` plugin.

If the per-alarm AI CAF is missing → notification uses `fs_fallback.caf` (never silent).

Corrupt/overlong CAF: conversion refuses empty base64; overlong files would make iOS play its default tone (Apple rule).

**Device test:** delete Library/Sounds CAF (or save without conversion) → alarm still chimes with fallback; regenerate voice → custom CAF returns.

---

## Rebuild note

After adding `fs_fallback.caf` to the notifications plugin, run a **native rebuild** (`npx expo run:ios` / EAS) so the sound is copied into the app bundle. Expo Go / JS-only reload is not enough.
