# Сесія з сестрою: Apple Developer → Submit (ціль 17–18 Oct)

**Мета:** за 1–2 години закрити все, що потребує її Apple-акаунту.  
**До сесії вже готово:** API, privacy/terms, support email, RevenueCat (Test Store), апка.

---

## Перед дзвінком (Анна, 10 хв)

- [ ] Сестра може увійти в Apple ID, який буде Developer  
- [ ] Mac з Xcode, кабель, iPhone  
- [ ] Відкрити: цей файл + Railway + RevenueCat + репо  
- [ ] Вирішити bundle id: рекомендуємо `com.futureself.alarm`  
- [ ] Support: `dyniza@uxdyniza.com`  
- [ ] Privacy: `https://api-production-5d0f.up.railway.app/privacy`  
- [ ] Terms: `https://api-production-5d0f.up.railway.app/terms`

---

## Блок A — Developer (сестрин логін) ~20 хв

1. https://developer.apple.com → Account → enroll / Accept if pending ($99)  
2. https://appstoreconnect.apple.com → **Agreements, Tax, and Banking**  
   - Paid Apps Agreement  
   - Tax / Banking forms (без цього підписки не продаються)  
3. Certificates, Identifiers & Profiles → **Identifiers** → **+** App ID  
   - Bundle ID: `com.futureself.alarm` (Explicit)  
   - Capabilities: **Sign In with Apple**, Push Notifications (якщо питає)  
4. Тим самим App ID → увімкнути Sign in with Apple  

Скажи агенту в Cursor:  
«Зміни bundle id на `com.futureself.alarm` і App Group відповідно, онови APPLE_CLIENT_ID»

---

## Блок B — App Store Connect app + підписка ~25 хв

1. App Store Connect → **My Apps** → **+** → New App  
   - Platform iOS  
   - Name: Future Self Alarm  
   - Bundle ID: щойно створений  
   - SKU: `futureselfalarm1`  
2. **Subscriptions** → Subscription Group → New  
3. Subscription:  
   - Product ID: `futureself_plus_monthly`  
   - Duration: 1 month  
   - **Introductory offer:** Free / 7 days  
4. Localization: назва + опис підписки  
5. App Privacy → Privacy Policy URL = privacy лінка вище  
6. App Information → support URL / email = `dyniza@uxdyniza.com`  
7. Pricing, screenshots (мінімум 6.7"), description (чернетка в `STORE_CHECKLIST.md`)

---

## Блок C — Підключити RevenueCat до Apple ~15 хв

1. App Store Connect → Users and Access → **Integrations** → **In-App Purchase** → Create key → завантажити `.p8`  
2. Запам’ятати **Key ID** + **Issuer ID**  
3. RevenueCat → Apps → Add **App Store** app → bundle id → завантажити `.p8` + Key ID + Issuer ID  
4. RC → Products → лінк `futureself_plus_monthly` на ASC product  
5. RC → скопіювати новий **`appl_…`** ключ  
6. В `.env` замінити Test Store key:
   ```bash
   EXPO_PUBLIC_REVENUECAT_IOS=appl_xxxx
   ```
7. Railway / APPLE_CLIENT_ID = новий bundle id  

---

## Блок D — Збірка і сабміт ~30–40 хв

1. Cursor агент: оновити bundle id, перезібрати Release / Archive  
2. TestFlight internal → швидкий smoke: sign in, clone, alarm, paywall sandbox  
3. Submit for Review **не пізніше 17–18 Oct**

---

## Якщо часу мало — пріоритет

1. Tax/Banking + App ID + підписка з trial  
2. RC `appl_` + скріни + Submit  
3. Сайт / ідеальний copy — після сабміту  
