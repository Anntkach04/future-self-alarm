# Permissions (just-in-time)

Do **not** ask for every permission during onboarding. Ask each only when the user first needs that feature.

| Permission | When we ask | Why |
|------------|-------------|-----|
| **Notifications** | Short onboarding screen → system permission sheet on Continue. If denied: bottom nudge on Home + Create Alarm (Allow / Settings). | Supporting alerts |
| **Microphone** | First tap to record on `VoiceRecord` | Clone sample |
| **Speech Recognition** | Same first record tap (only if STT available). Optional — deny → mic-only clone | Live script follow-along |
| **AlarmKit** | Short onboarding screen after notifications → system sheet on Continue. If denied: bottom nudge → Settings. | Real system wake alarm with cloned voice |
| **Tracking (ATT)** | **Never** — we do not track under Apple’s ATT definition | — |

## Onboarding order

Intro → **Sign in with Apple** (Continue skips) → Name… → Voice preview → **Notifications** → **AlarmKit** → Paywall → Home.

No mic / speech / ATT on the notifications or AlarmKit steps.
