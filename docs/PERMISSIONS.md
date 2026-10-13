# Permissions (just-in-time)

Do **not** ask for every permission during onboarding. Ask each only when the user first needs that feature.

| Permission | When we ask | Why |
|------------|-------------|-----|
| **Notifications** | Onboarding screen after Sign in with Apple (`NotificationPermission`) — clear purpose + Settings deep-link if denied. Also again when saving an alarm if still denied. | Morning wake alerts with custom voice CAF |
| **Microphone** | First tap to record on `VoiceRecord` | Clone sample |
| **Speech Recognition** | Same first record tap (only if STT available). Optional — deny → mic-only clone | Live script follow-along |
| **AlarmKit** | Only if/when we call `scheduleWithAlarmKit` (not on launch; not on notification screen). Current clone wakes use notifications + CAF, so most users never see this prompt. | System AlarmKit UI when used |
| **Tracking (ATT)** | **Never** — we do not track under Apple’s ATT definition | — |

## Onboarding order (unchanged product flow)

Voice preview → Sign in with Apple → **Notifications** (this screen only) → Paywall → Home.

No mic / speech / AlarmKit / ATT on that notifications step.
