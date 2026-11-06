# Checklist до запуску App Store

Target submit: **17–18 Oct** → live ~**20 Oct**.  
Sister лише для blog email пізніше. Apple enroll — ти сама.

Розробка з **локальної** копії (iCloud вішає Expo):  
`~/Developer/alarm-from-future`

Release ritual (buildNumber, дані, backend): **`docs/UPDATES.md`**  
Alarm engine: **`docs/ALARM_ENGINE.md`** · Permissions: **`docs/PERMISSIONS.md`**

---

## Пріоритет перед submit

1. [x] **Голос після оновлення збірки** — migrations wipe `audioUri`/CAF on mix bumps; `AlarmAudioRepairHost` auto-rebuilds from `voiceId` (no re-Save). Still verify on device after next Release.
2. [ ] ElevenLabs: кілька **незалежних** акаунтів / ≥3 голоси, ізоляція voice ID
3. [ ] Реальні **sandbox**-покупки Apple (без debug bypass) + Restore
4. [ ] Повний flow у **TestFlight** без тестових кнопок
5. [ ] Smoke на **кількох фізичних iPhone** + підтримувані версії iOS

**AlarmKit окремо:** Apple вміє системне планування, повтори й snooze — але **довге персоналізоване аудіо** (ваш голос / CAF) треба перевірити на реальному пристрої окремо від «системний будильник дзвонить».

**Перша платна підписка:** подавати на Review **разом із новою версією** апки. Потрібні privacy disclosures, metadata і працездатний demo access для рев’ю.

---

## Уже готово (не чіпати без потреби)

- [x] Онбординг: voice preview → Apple Sign In → Notifications → Paywall → Home
- [x] Paywall + Subscription (RC код, trial copy, restore, legal links)
- [x] Account окремо: Menu → Account (не на Home)
- [x] Infinite time ticker
- [x] Privacy / Terms на API + лінки в апці
- [x] Support: `dyniza@uxdyniza.com`
- [x] Prod API URL, JWT/auth на бекенді, profile sync
- [x] Dev bypasses вимкнені (`docs/SISTER.md` / `devBypass`)
- [x] Метадата / shot list (нижче)
- [x] ElevenLabs logo, bg `#FFFCF5`, snooze ~10 хв
- [x] Silent session refresh + soft Reconnect banner (див. `docs/UPDATES.md`)
- [x] Storage migrations (`schemaVersion`) перед hydrate
- [x] Soft App Store update banner via `MIN_APP_VERSION` / `APP_STORE_URL`
- [x] Alarm engine hardening (≤28s CAF, system snooze chain, fallback CAF, iOS 26.1 min)
- [x] Just-in-time permissions (notif screen ≠ mic/speech/AlarmKit/ATT)
- [x] Honest wake copy (not Clock / Focus caveat) in notif + create alarm + settings
- [x] Delete account — Menu → Account + `DELETE /api/me`
- [x] JWT in Keychain (`expo-secure-store`) with AsyncStorage migrate
- [x] Manage Subscription → `Purchases.showManageSubscriptions` / App Store URL
- [x] Privacy/Terms SSOT = `server/public/*` (marketing redirects to API)

---

## Залишилось ДО submit

### A. Ти зараз (поки enroll / паралельно)

1. [x] **Apple Developer enroll** — Active
2. [ ] **Прогін на телефоні** з `~/Developer/alarm-from-future`:  
      onboarding → Apple → notif → AlarmKit → paywall → Home → alarm → test voice
3. [ ] **Скріншоти** 6.7" (і бажано 6.1") — таблиця внизу
4. [ ] **Gmail filter** `[Future Self Alarm]` + тестовий лист собі  
      (`docs/SUPPORT_INBOX.md`)
5. [ ] Підтвердити, що **privacy/terms** відкриваються:  
      https://api-production-5d0f.up.railway.app/privacy  
      https://api-production-5d0f.up.railway.app/terms

### B. Після Active membership (блокер submit)

Повний cutover також у `docs/UPDATES.md` → «After Apple Developer is Active».

1. [ ] App Store Connect → **Agreements, Tax, Banking** (Paid Apps Agreement)
2. [x] Bundle id → `com.futureself.alarm` (+ App Group) у коді (b71)  
      [ ] Railway `APPLE_CLIENT_ID=com.futureself.alarm`  
      [ ] Developer portal: App Group `group.com.futureself.alarm` + прив’язати до App ID
3. [ ] Capabilities: Sign in with Apple, Push / AlarmKit
4. [ ] Створити app record в ASC
5. [ ] IAP: `futureself_plus_monthly` + **7-day free trial**  
      entitlement RC: `future_self_alarm_pro`  
      → першу підписку подати **разом** із версією апки
6. [ ] RevenueCat: App Store app + `appl_` ключ у білд + лінк product  
      Product IDs **точно** як у коді
7. [ ] Privacy nutrition labels + description/keywords (чернетка нижче)  
      + voice data: збір / зберігання / видалення
8. [ ] Set Railway `APP_STORE_URL` після listing
9. [ ] Bump `ios.buildNumber` → Archive → **TestFlight** → sandbox purchase (без bypass)
10. [ ] Age rating, категорія, регіони; Review notes + demo access
11. [ ] **Submit for Review**
12. [ ] Кожен наступний патч: `version` + `buildNumber++` (див. UPDATES.md)

### C. App Review compliance (код у `~/Developer/alarm-from-future`)

1. [x] Harden Sign-In fail-closed (`SignInScreen` + `apiAuth`) — без silent `local_` на Release
2. [x] Release fail-closed без RC key (`subscriptions.ts` — unlock лише `__DEV__`)
3. [x] StoreKit price line на paywall (`getMonthlyPriceDisclosure` → один `Text`)
4. [x] Apple revoke-on-delete (`server/lib/appleRevoke.js` + `DELETE /api/me`) — треба env `.p8` на Railway
5. [x] PrivacyInfo via `app.json` → `ios.privacyManifests`
6. [ ] Gate Home / features по entitlement після кінця trial (вже є `EntitlementGateHost` коли є RC key)
7. [ ] Купівля строго по product id `futureself_plus_monthly` (після ASC product)

---

## Device QA — Будильник та iOS

Перевіряти на **реальному** iPhone (не симулятор). Окремо: системний дзвінок vs **ваш** персоналізований звук.

- [ ] AlarmKit (або заявлений механізм) перевірено на пристрої
- [ ] Спрацьовує при **заблокованому** екрані
- [ ] Спрацьовує після **закриття** апки (swipe away)
- [ ] Після **оновлення збірки** старий будильник працює **без** повторного Save  
      _(пріоритет #1 — голос не губиться)_
- [ ] Кожен будильник грає **правильний** голос / CAF цього юзера
- [ ] Довге персоналізоване аудіо реально чути на wake (не лише default tone)
- [ ] **Snooze 10 min** працює і **не** плодить дублікати
- [ ] Повтори в **вибрані дні**
- [ ] Перезапуск iPhone не ламає розклад
- [ ] Offline: заявлена функціональність (локальний wake) не падає
- [ ] Silent mode, Focus, дозволи (notif + AlarmKit) — очікувана поведінка
- [ ] Зміна часового поясу обробляється коректно
- [ ] Якщо аудіо недоступне — зрозумілий **fallback** (не тиша без пояснення)

---

## Device QA — ElevenLabs та голоси

- [ ] Новий юзер клонує **свій** голос end-to-end
- [ ] ≥ **3 різні** голоси / незалежні акаунти
- [ ] Voice ID правильно прив’язаний до юзера
- [ ] Генерація + завантаження аудіо без помилок
- [ ] Запис: не зависає; рядки / Continue працюють передбачувано
- [ ] Невдале клонування → помилка + Retry / continue anyway
- [ ] Після рестарту апки клон **зберігається**
- [ ] Юзер A **не** чує / не дістає голос юзера B
- [ ] Quotas, rate limits, вартість генерації — оцінені для launch
- [ ] Згода на клон + **видалення** voice data працюють (Account delete)

---

## Device QA — Backend, API, безпека

- [ ] Жоден секретний API key **не** в клієнті (лише `EXPO_PUBLIC_*`)
- [ ] Production endpoints без localhost / LAN
- [ ] Авторизація на кожному захищеному endpoint
- [ ] Дані юзерів ізольовані
- [ ] Supabase RLS / DB access rules перевірені (якщо в проді)
- [ ] Таймаути, retries, network failure UX
- [ ] Захист від дублів запитів / зайвих $$ на TTS
- [ ] Prod конфіг відокремлений від dev
- [ ] Backup / recovery план для критичних даних
- [ ] Crash reporting **без** витоку голосів, JWT, raw audio

---

## Device QA — Apple subscriptions

- [ ] Підписки створені в App Store Connect
- [ ] Product IDs = код (`futureself_plus_monthly` тощо)
- [ ] Paid Apps Agreement + banking + tax
- [ ] Sandbox purchase **без** тестового bypass
- [ ] Cancel purchase **не** відкриває Pro
- [ ] Restore Purchases працює
- [ ] Активна підписка після рестарту апки
- [ ] Кінець trial / expiry коректно ріже доступ
- [ ] Pending / failed / refunded — очікувана поведінка
- [ ] Paywall: ціна, період, умови, Privacy/Terms лінки

---

## Device QA — Onboarding та UX

- [ ] Екрани в правильному порядку (див. `.cursor/rules/later-onboarding.mdc`)
- [ ] Немає зависання на cloning / You’re all set
- [ ] Success → далі за ~4–5 с (або тап)
- [ ] Continue / Back / Skip лише де передбачено
- [ ] Заголовки й subheadings вирівняні; картки не стрибають
- [ ] Анімації без flicker / layout jumps
- [ ] Текст не обрізається на маленьких iPhone
- [ ] Dynamic Type / великі шрифти + VoiceOver smoke
- [ ] Тестові кнопки (`test in 10s`, skip, reset) **приховані** в store/TestFlight Release

---

## Device QA — Акаунт та стабільність

- [ ] Fresh install → повний flow
- [ ] Returning user **не** ганяють знову через онбординг
- [ ] Прогрес після kill апки
- [ ] Відмова mic / speech обробляється
- [ ] Немає нескінченних loading
- [ ] Немає відомих critical crashes
- [ ] Logout / login не зносить локальні alarms без потреби
- [ ] Delete account + пов’язані дані (voice, profile, Apple revoke)
- [ ] Оновлення збірки **не** валить налаштування / голос
- [ ] Кілька фізичних iPhone + мін. підтримувана iOS

---

## App Store та юридичні

- [ ] App name, Bundle ID, version, build number
- [ ] Icon + launch screen
- [ ] Privacy Policy — публічний URL
- [ ] Terms of Use — публічний URL
- [ ] Support URL + `dyniza@uxdyniza.com` працюють
- [ ] App Privacy disclosures заповнені
- [ ] Описані voice data: обробка / зберігання / видалення
- [ ] Purpose strings (mic, speech, AlarmKit, local network) зрозумілі
- [ ] Screenshots + description готові
- [ ] Age rating, категорія, регіони
- [ ] Review: demo account / інструкції (нижче)
- [ ] Актуальні [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

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

This is not the iPhone Clock app. Wake uses AlarmKit (system alarm) with notification fallback and your cloned voice.

Support: dyniza@uxdyniza.com  
Privacy: https://api-production-5d0f.up.railway.app/privacy  
Terms: https://api-production-5d0f.up.railway.app/terms

**Keywords:** alarm,morning,voice,wake,motivation,routine,self,clone,affirmation  
**Category:** Lifestyle (secondary: Health & Fitness)  
**Copyright:** 2026 Future Self Alarm

**Review notes:**  
Sign in with Apple required. Allow notifications + alarms when prompted. Paywall: 7-day free trial then monthly (RevenueCat / StoreKit). Demo: short voice sample → Home → schedule near-term alarm (or use in-app test if present in build). Support: dyniza@uxdyniza.com. First subscription submitted with this binary.

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
2. **Пріоритет #1:** голос будильника після оновлення збірки  
3. Прогін апки з `~/Developer/alarm-from-future` + Device QA блоки вище  
4. Скріншоти + support test mail  
5. Як тільки Active → B.1–B.11 без пауз  
