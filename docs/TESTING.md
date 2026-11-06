# Test on your iPhone

## One-time setup

1. **Node via nvm** — add to `~/.zshrc` if `npm` is “command not found”:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
```

Then `source ~/.zshrc`.

2. **Install deps** (project root + server):

```bash
cd "/Users/annatkach/Library/Mobile Documents/com~apple~CloudDocs/future-self-newsletter/alarm from future"
npm install
cd server && npm install && npm run beds:download && cd ..
```

3. **`.env`** in project root (API keys + phone URL):

```
ELEVENLABS_API_KEY=...
OPENAI_API_KEY=...
EXPO_PUBLIC_API_URL=http://YOUR_MAC_IP:8787
```

Find Mac IP: System Settings → Wi‑Fi → Details.

4. **Dev build on iPhone** (not Expo Go — mic + speech need native modules):

```bash
npx expo run:ios --device
```

First build takes several minutes. Phone and Mac must be on the same Wi‑Fi.

## Every test session

**Terminal 1 — API server:**

```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
cd "/Users/annatkach/Library/Mobile Documents/com~apple~CloudDocs/future-self-newsletter/alarm from future"
npm run server
```

If port 8787 is busy, the server is already running — don’t start a second one.

**Terminal 2 — app** (after first `run:ios`, you can use):

```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
cd "/Users/annatkach/Library/Mobile Documents/com~apple~CloudDocs/future-self-newsletter/alarm from future"
npx expo start --dev-client
```

## Permissions (when the app asks)

| When | What |
|------|------|
| Wake-up time → Continue | **Notifications** |
| Voice record → mic tap | **Microphone** + **Speech recognition** |
| Save alarm | Notifications again if denied |

Configured in `app.json` (expo-audio, expo-notifications, expo-speech-recognition). Min iOS **26.1**.

## Data & dev tools

- **Onboarding + profile + voice** → saved on device (`AsyncStorage`). Reopen app → **Home** if you already finished once.
- **Alarms** → saved and rescheduled on launch.
- **Menu → reset (dev)** → wipes profile, voice, alarms; onboarding from Intro again.

To remove reset later, tell Cursor: «Прибери dev reset онбордингу (ONBOARDING_RESET_ENABLED)».

## Quick checklist

- [ ] Server health: `http://localhost:8787/api/health` on Mac
- [ ] Phone reaches server: same Wi‑Fi, `EXPO_PUBLIC_API_URL` = Mac IP
- [ ] Mood advice varies (not the same fallback text)
- [ ] Voice record highlights words when you read the script
- [ ] Alarm saves and notification is scheduled
- [ ] Right after save, Home shows Preparing until the wake voice is scheduled, then the normal armed alarm
- [ ] Voice record: redo throws away the take and starts the script again, without a short listen

## Alarm engine (device — before release)

See **`docs/ALARM_ENGINE.md`**. After adding `assets/sounds/fs_fallback.caf`, rebuild native iOS.

- [ ] Lock screen: custom voice CAF plays (≤~28s), not only default beep
- [ ] Open app from alert: full MP3 can play; **I'm up** stops further rings
- [ ] Force-quit → wake → wait ~10 min → second ring without opening app
- [ ] I'm up → no more rings that morning
- [ ] Missing AI CAF → bundled fallback chime still plays
- [ ] Build requires iOS 26.1+ (no install on ≤25)
