# Alarm engine — pre-release checks

Target: iOS **26.1+** (`app.json` → `ios.deploymentTarget`). AlarmKit does not exist on iOS 25 and below; we require 26.1 rather than shipping a limited fallback OS.

Wake path for **cloned** voices: local **time-sensitive notifications** + CAF in `Library/Sounds` (not Clock.app). AlarmKit is warmed for auth only — dynamic Library/Sounds names often resolve to the default system tone, so Kit is **not** used for per-user clones.

---

## 1. Custom voice audio (≤30s system limit)

| Layer | What plays | Limit |
|-------|------------|--------|
| Lock screen / notification sound | CAF from `installAlarmSystemSound` | **≤28s** encoded (`ALARM_WAKE_SOUND_MAX_SECONDS`) — Apple rejects >30s and plays default |
| App open / “I'm up” screen | Full MP3 via `expo-audio` | Full AI message |

Apple: [UNNotificationSound](https://developer.apple.com/documentation/usernotifications/unnotificationsound) — custom sounds must be under 30 seconds.

**Device test:** lock phone, let alarm fire, confirm voice CAF plays (not only default beep). Unlock/open app → full MP3 may continue.

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
