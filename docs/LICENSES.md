# Future Self Alarm — services, licences, permissions

Working inventory so we can ship without mixing “YouTube music” into an iPhone alarm. This is a product checklist, not legal advice. Before App Store, a lawyer should read the live terms of each vendor.

Last updated: 17 August 2026.

## What the alarm actually does with music

The bed is mixed under the cloned voice, looped, volume-lowered, faded, stored on device, and played to the person as the alarm. That is **software / in-app use for end users**, not a YouTube video. A Creator-style “publish on social” licence does not cover it.

## Vendor inventory

| Vendor | Used for | Plan we need | App Store OK? | Proof to keep | Notes |
|---|---|---|---|---|---|
| **ElevenLabs** | Clone the user’s voice, TTS of the morning script | Paid (commercial). Free = non-commercial + attribution | Yes, if paid | Invoice / plan screenshot, API key date | Clone only the user’s own recording. Paid plans do not require “powered by” on every screen. Credit in Menu is a collab choice, not a legal fix. |
| **OpenAI** | Write the morning script from onboarding answers | Paid API | Yes, if paid | Invoice, model name (`gpt-4o`) | API output is yours to use commercially if you follow their terms. Do not put the API key in the app binary. |
| **Epidemic Sound** | YouTube / social for Anna’s own channels | Creator | **No for the app** | Creator subscription | Their own table marks **Apps & games** with an X on Creator/Pro. Do not bundle ES tracks in the alarm. Do not put “Music · Epidemic Sound” in the shipping app until a written app licence (Business / Partner API). YouTube stays fine. |
| **CC0 spa / morning beds** | Quiet music under the voice | CC0 1.0 | Yes | Download page URL, licence screenshot, date, filename | Vibe: Bali, yoga, massage, morning. Pads, guitar, handpan, flute — not melancholic piano. List: `docs/music/SOURCES.md`. |
| **Original commission** (later) | Custom piano beds | Work-for-hire / assignment of copyright | Yes, if the contract says so | Signed contract + WAV masters | Cleanest long-term. You own the recordings. |
| **Bensound / similar app-licence libraries** (optional) | If CC0 quality is not enough | Paid plan that **names apps / games** | Only if the PDF says apps | Licence PDF + track list | “Royalty-free” alone is not enough. The word **app** or **software** must be in the licence. |
| **FFmpeg** (`ffmpeg-static`) | Mix voice + bed on **our server** | LGPL/GPL of the binary | Yes if FFmpeg is **not** inside the iOS/Android app | Keep mixing on the server | Users receive a mixed MP3, not FFmpeg. Do not ship the ffmpeg binary in the phone app. |
| **Expo / React Native / fonts** | The app itself | MIT / SIL OFL (fonts) | Yes | `package.json` lockfile | Standard open-source stack. |
| **Apple (iOS)** | AlarmKit, mic, notifications | Apple Developer + user permission | Required | Entitlements, App Store privacy nutrition label | AlarmKit is iOS 26+. Mic for clone. Notifications/alarms to wake the phone. |
| **The user** | Their voice, name, onboarding answers | Explicit consent in onboarding | Required | In-app copy + privacy policy | They must agree that we clone **their** voice and generate audio for **their** alarm. Never clone someone else. |

## Do not use in the app

- Epidemic Sound Creator / Pro downloads
- YouTube Audio Library (YouTube-only)
- Mixkit music (excludes games; apps are the same risk)
- Random “royalty-free” MP3s without a page that says **app, game, or software**
- ElevenLabs free-plan output in a paid product

## Permissions the human must grant

1. Microphone — to record the clone sample.
2. Consent to voice cloning — short, plain sentence on the record screen.
3. Notifications / exact alarms — so the phone can wake them.
4. Privacy policy — what we send to OpenAI and ElevenLabs (script answers, voice sample), where it is stored, how to delete.

## Folder for proof

Keep receipts here (do not commit secrets or purchased files if the licence forbids redistribution of the masters):

- `docs/music/` — licence screenshots and source URLs
- Accounting — ElevenLabs + OpenAI invoices
- Email — any Epidemic partnership reply

## Open items

- [ ] Replace Epidemic beds with CC0 (or commissioned) files in `server/assets/beds/`
- [ ] Screenshot each CC0 download page the day we add the file
- [ ] Privacy policy draft before TestFlight
- [ ] Confirm ElevenLabs account is on a **paid** plan
- [ ] Confirm OpenAI API has billing enabled
- [ ] Epidemic: YouTube only, until a written app licence
