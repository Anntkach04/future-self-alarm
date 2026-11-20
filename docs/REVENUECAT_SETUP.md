# RevenueCat setup (before Apple IAP link)

Do this now. Linking App Store products happens later with sister + ASC.

## 1. Create account / project

1. Open https://app.revenuecat.com and sign up / log in  
2. **Create new project** → name: `Future Self Alarm`  
3. **Add app** → platform **iOS**  
4. Bundle ID: `com.futureself.alarm`

## 2. Copy the public SDK key

1. Project → **API keys** (or App settings)  
2. Copy **Apple public app-specific key** (`appl_…`)  
3. Put it in the project root `.env`:

```bash
EXPO_PUBLIC_REVENUECAT_IOS=appl_xxxxxxxx
```

Do **not** commit this to git.

## 3. Entitlement + product (placeholders)

In RevenueCat:

1. **Entitlements** → `future_self_alarm_pro` (already created)  
2. **Products** → prefer id `futureself_plus_monthly` for the monthly plan  
3. Attach monthly product → entitlement `future_self_alarm_pro`  
4. **Offerings** → Default → package **Monthly** → that product  

App code expects:
- entitlement: `future_self_alarm_pro`
- monthly product id (preferred): `futureself_plus_monthly`

## 4. After Apple Developer (with sister)

1. Create subscription in App Store Connect with id `futureself_plus_monthly`  
   - 7-day free trial intro offer  
2. In RevenueCat → Products → link that App Store product  
3. Rebuild the iOS app so `EXPO_PUBLIC_REVENUECAT_IOS` is baked in  

## 5. Quick test later

- Device build with the key set  
- Paywall → Start free week (Sandbox Apple ID)  
- Menu → Subscription shows Trial / Member  
