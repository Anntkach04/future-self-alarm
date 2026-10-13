# Updates, account, data — founder ritual

How Future Self stays stable across launches and App Store releases.

## Account (no daily login)

1. First onboarding: Sign in with Apple once.
2. Phone stores: profile, alarms, `appleUserId`, JWT (~90 days).
3. Next opens: Home directly when `onboardingComplete`.
4. Cold start: `SessionRefreshHost` probes `/api/me`.  
   - OK → nothing  
   - Offline → keep local  
   - 401 → soft banner “Reconnect” (alarms stay)  
5. Reinstall / new phone: Sign in with Apple → cloud hydrate (`voiceId`). Sample audio file is local-only.

## Shipping an update (no OTA for v1)

Every change ships as a **new native build** via TestFlight / App Store.

```text
code → bump version/buildNumber → Archive → TestFlight → What’s New → Submit
```

### Before every Archive

1. Bump in `app.json`:
   - `expo.version` (user-facing, e.g. `1.0.1`)
   - `expo.ios.buildNumber` (must increase every upload, e.g. `"2"`)
2. Run device smoke: open app → Home still there → alarms intact → set +2 min wake
3. Backend-only changes: deploy Railway only; do **not** break old clients for 14+ days

### Soft “update available”

Railway env (optional):

```bash
MIN_APP_VERSION=1.0.1
# FORCE_APP_VERSION=1.0.0   # optional harder floor
APP_STORE_URL=https://apps.apple.com/app/idYOUR_ID
```

App shows a dismissible banner when `version < minAppVersion`.

## After Apple Developer is Active

One-shot native cutover (do together, then rebuild):

1. ASC: Agreements, Tax, Banking
2. Bundle id → `com.futureself.alarm` (+ App Group if used)
3. Update `app.json` `ios.bundleIdentifier`
4. Railway `APPLE_CLIENT_ID=com.futureself.alarm`
5. Capabilities: Sign in with Apple
6. ASC app + IAP `futureself_plus_monthly` (7-day trial)
7. RevenueCat `appl_` key into Release `.env` / EAS secrets
8. Set `APP_STORE_URL` after the listing exists
9. First submit, then patch train with buildNumber++

## Storage migrations

- Schema key: `fsa.storage_schema.v1`
- Code: `src/services/migrations.ts`
- Runs **before** providers hydrate in `App.tsx`
- Never wipe on upgrade — only transform

When you change AsyncStorage shape: bump `STORAGE_SCHEMA_VERSION` and add a migration step.

## Backend vs app

| Change | Where | App rebuild? |
|--------|-------|--------------|
| Privacy/terms copy | Railway | No |
| JWT TTL / minAppVersion | Railway env | No |
| Clone / alarm script | Railway | No |
| UI, AlarmKit, plugins | App | Yes |
| Bundle id / SIWA | App + portal | Yes |

## What’s New template

```text
• More reliable morning wake with your voice
• Fixes and polish
```

## Don’t

- Don’t force Apple login on every launch
- Don’t clear AsyncStorage on update
- Don’t schedule AlarmKit with Library/Sounds CAF names (default beep risk)
- Don’t deploy breaking `/api/auth/apple` without a versioned path
