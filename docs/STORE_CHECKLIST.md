# Checklist до запуску App Store

Target submit: **17–18 Oct** → live ~**20 Oct**.  
Sister лише для blog email пізніше. Apple enroll — ти сама.

Розробка з **локальної** копії (iCloud вішає Expo):  
`~/Developer/alarm-from-future`

---

## Уже готово (не чіпати без потреби)

- [x] Онбординг: voice preview → Apple Sign In → Notifications → Paywall → Home
- [x] Paywall + Subscription (RC код, trial copy, restore, legal links)
- [x] Account окремо: Menu → Account (не на Home)
- [x] Infinite time ticker
- [x] Privacy / Terms на API + лінки в апці
- [x] Support: `dyniza@uxdyniza.com`
- [x] Prod API URL, JWT/auth на бекенді, profile sync
- [x] Dev bypasses вимкнені
- [x] Метадата / shot list (нижче)
- [x] ElevenLabs logo, bg `#FFFCF5`, swipe delete, snooze ~10 хв
- [x] Silent session refresh + soft Reconnect banner (див. `docs/UPDATES.md`)
- [x] Storage migrations (`schemaVersion`) перед hydrate
- [x] Soft App Store update banner via `MIN_APP_VERSION` / `APP_STORE_URL`
- [x] Alarm engine hardening (≤28s CAF, system snooze chain, fallback CAF, iOS 26.1 min) — **`docs/ALARM_ENGINE.md`**
- [x] Just-in-time permissions (notif screen ≠ mic/speech/AlarmKit/ATT) — **`docs/PERMISSIONS.md`**
- [x] Honest wake copy (not Clock / Focus caveat) in notif + create alarm + settings
- [x] Delete account — Menu → Account + `DELETE /api/me`
- [x] JWT in Keychain (`expo-secure-store`) with AsyncStorage migrate
- [x] Manage Subscription → `Purchases.showManageSubscriptions` / App Store URL
- [x] Privacy/Terms SSOT = `server/public/*` (marketing redirects to API)

Release ritual (buildNumber, дані, backend): **`docs/UPDATES.md`**

---

## Залишилось ДО submit

### A. Ти зараз (поки enroll / паралельно)

1. [ ] **Apple Developer enroll** — Active (Safari / iPhone / email support)
2. [ ] **Прогін на телефоні** з `~/Developer/alarm-from-future`:  
      onboarding → Apple → notif → paywall → Home → alarm → test voice
3. [ ] **Скріншоти** 6.7" (і бажано 6.1") — таблиця внизу
4. [ ] **Gmail filter** `[Future Self Alarm]` + тестовий лист собі  
      (`docs/SUPPORT_INBOX.md`)
5. [ ] Підтвердити, що **privacy/terms** відкриваються:  
      https://api-production-5d0f.up.railway.app/privacy  
      https://api-production-5d0f.up.railway.app/terms

### B. Після Active membership (блокер submit)

Повний cutover також у `docs/UPDATES.md` → «After Apple Developer is Active».

1. [ ] App Store Connect → **Agreements, Tax, Banking**
2. [ ] Bundle id → `com.futureself.alarm` (+ App Group)  
      оновити `app.json`, код, Railway `APPLE_CLIENT_ID`
3. [ ] Capabilities: Sign in with Apple, Push / AlarmKit
4. [ ] Створити app record в ASC
5. [ ] IAP: `futureself_plus_monthly` + **7-day free trial**  
      entitlement RC: `future_self_alarm_pro`
6. [ ] RevenueCat: App Store app + `appl_` ключ у білд + лінк product
7. [ ] Privacy nutrition labels + description/keywords (чернетка нижче)
8. [ ] Set Railway `APP_STORE_URL` після listing
9. [ ] Bump `ios.buildNumber` → Archive → **TestFlight** → sandbox purchase
10. [ ] **Submit for Review**
11. [ ] Кожен наступний патч: `version` + `buildNumber++` (див. UPDATES.md)

### C. Опційно перед review (якість)

1. [ ] Harden Sign-In (не пускати з `local_` юзером на проді)
2. [ ] Gate Home / features по entitlement після кінця trial
3. [ ] Купівля строго по product id `futureself_plus_monthly`

---

## App Store copy (вставити в ASC)

**Name:** Future Self Alarm  
**Subtitle:** Wake up to your own voice  
**Promotional text:**  
A morning alarm that sounds like you from the future. Clone your voice, set the tone, and let tomorrow greet you gently.

**Description:**  
Future Self Alarm wakes you with a short message in your own cloned voice.

Record once. Choose how mornings should feel. Optionally check in on your mood the night before. When the alarm rings, it is your voice - calmer, clearer, already on your side.

What you get:
- Voice clone from a short recording
- Personalized morning scripts
- Mood check-in that can shape tomorrow’s line
- Soft music bed under your voice
- 7-day free trial, then monthly

This is not the iPhone Clock app. Alarms play through Future Self notifications with your cloned voice.

Support: dyniza@uxdyniza.com  
Privacy: https://api-production-5d0f.up.railway.app/privacy  
Terms: https://api-production-5d0f.up.railway.app/terms

**Keywords:** alarm,morning,voice,wake,motivation,routine,self,clone,affirmation  
**Category:** Lifestyle (secondary: Health & Fitness)  
**Copyright:** 2026 Future Self Alarm

**Review notes:**  
Sign in with Apple required. Allow notifications when prompted. Paywall: 7-day free trial then monthly (RevenueCat / StoreKit). Demo: short voice sample → Home → schedule near-term alarm. Support: dyniza@uxdyniza.com.

---

## Screenshot shot list

Мінімум **6.7"** (Pro Max). Бажано ще **6.1"**.

| # | Екран | Що показати |
|---|--------|-------------|
| 1 | Home | Mood + next alarm / empty add alarm |
| 2 | Voice ready | You’re all set / clone ready |
| 3 | Preview / morning line | Voice preview або script |
| 4 | Mood | Evening mood check-in |
| 5 | Paywall | 7-day trial + monthly |
| 6 | Account (optional) | Menu → Account |

---

## Швидкий порядок на сьогодні

1. Enroll Apple (або follow-up support)  
2. Прогін апки з `~/Developer/alarm-from-future`  
3. Скріншоти + support test mail  
4. Як тільки Active → B.1–B.9 без пауз  
