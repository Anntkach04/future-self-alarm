import { Linking, Platform } from 'react-native';

const APPLE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

/** Entitlement id configured in RevenueCat (+ App Store Connect later). */
export const ENTITLEMENT_ID = 'future_self_alarm_pro';

/** Preferred product id — match RevenueCat / App Store when linking. */
export const MONTHLY_PRODUCT_ID = 'futureself_plus_monthly';

export type SubStatus = {
  active: boolean;
  /** true while in Apple introductory / free trial period */
  inTrial: boolean;
  /** ISO expiry if known */
  expiresAt: string | null;
  /** Product identifier, if any */
  productId: string | null;
  source: 'revenuecat' | 'dev' | 'none';
};

const DEV_ACTIVE: SubStatus = {
  active: true,
  inTrial: true,
  expiresAt: null,
  productId: 'dev.monthly.trial',
  source: 'dev',
};

let configured = false;
/** Apple user id — RevenueCat app user id, so entitlements follow the account. */
let knownUserId: string | null = null;
/** User id RevenueCat is currently logged in as (null = anonymous). */
let rcUserId: string | null = null;

/** Call on launch (from stored settings) before any RC call. */
export function setPurchasesUserId(userId: string | null) {
  knownUserId = userId || null;
}

function iosApiKey() {
  const key = process.env.EXPO_PUBLIC_REVENUECAT_IOS?.trim() || '';
  // RevenueCat kills Release builds that use a test_ key — never configure it.
  if (key.startsWith('test_') && !(typeof __DEV__ !== 'undefined' && __DEV__)) {
    return '';
  }
  return key;
}

/** Metro / simulator only — never unlock paid features in Release without RC. */
function allowDevUnlockWithoutKey() {
  return typeof __DEV__ !== 'undefined' && __DEV__ && !iosApiKey();
}

export async function configurePurchases(appUserId?: string | null) {
  if (Platform.OS === 'web') return false;
  const key = iosApiKey();
  if (!key) return false;
  if (appUserId) knownUserId = appUserId;
  appUserId = appUserId || knownUserId;
  try {
    const Purchases = (await import('react-native-purchases')).default;
    if (!configured) {
      Purchases.configure({
        apiKey: key,
        appUserID: appUserId || undefined,
      });
      configured = true;
      rcUserId = appUserId || null;
    } else if (appUserId && appUserId !== rcUserId) {
      await Purchases.logIn(appUserId);
      rcUserId = appUserId;
    }
    return true;
  } catch (error) {
    console.warn('Purchases configure failed', error);
    return false;
  }
}

export async function getSubscriptionStatus(): Promise<SubStatus> {
  if (Platform.OS === 'web') return { ...DEV_ACTIVE, source: 'dev' };
  const key = iosApiKey();
  if (!key) {
    if (allowDevUnlockWithoutKey()) return { ...DEV_ACTIVE };
    return {
      active: false,
      inTrial: false,
      expiresAt: null,
      productId: null,
      source: 'none',
    };
  }
  try {
    const Purchases = (await import('react-native-purchases')).default;
    await configurePurchases();
    const info = await Purchases.getCustomerInfo();
    const ent = info.entitlements.active[ENTITLEMENT_ID];
    if (!ent) {
      return {
        active: false,
        inTrial: false,
        expiresAt: null,
        productId: null,
        source: 'revenuecat',
      };
    }
    const periodType = String((ent as { periodType?: string }).periodType || '');
    return {
      active: true,
      inTrial: /trial/i.test(periodType),
      expiresAt: ent.expirationDate ?? null,
      productId: ent.productIdentifier ?? null,
      source: 'revenuecat',
    };
  } catch (error) {
    console.warn('getSubscriptionStatus failed', error);
    return {
      active: false,
      inTrial: false,
      expiresAt: null,
      productId: null,
      source: 'none',
    };
  }
}

async function resolveMonthlyPackage() {
  const Purchases = (await import('react-native-purchases')).default;
  await configurePurchases();
  const offerings = await Purchases.getOfferings();
  const packages = offerings.current?.availablePackages ?? [];
  return (
    packages.find(
      (p) =>
        p.product.identifier === MONTHLY_PRODUCT_ID ||
        p.identifier === MONTHLY_PRODUCT_ID
    ) ??
    // Never fall back to an arbitrary package — the paywall copy says monthly.
    packages.find((p) => p.packageType === 'MONTHLY') ??
    null
  );
}

export type MonthlyPlanDetails = {
  /** Localized price string from StoreKit, e.g. "$4.99" */
  priceString: string | null;
  /**
   * Free-trial length THIS Apple ID can still get, else null (no trial
   * offer, already used, or unknown). Never promise a trial we can't give.
   */
  trialDays: number | null;
  /** Short price line, e.g. "7 days free, then $4.99/mo" or "$4.99/mo". */
  headline: string;
  /** Full disclosure line for App Review 3.1.2(c) */
  disclosure: string;
  productId: string;
};

const RENEW_NOTE = 'Auto-renews until canceled in Apple ID Subscriptions.';

function introTrialDays(intro: {
  price: number;
  periodUnit: string;
  periodNumberOfUnits: number;
  cycles: number;
} | null | undefined): number | null {
  if (!intro || intro.price !== 0) return null;
  const units = Math.max(1, intro.periodNumberOfUnits || 1) * Math.max(1, intro.cycles || 1);
  switch (String(intro.periodUnit).toUpperCase()) {
    case 'DAY':
      return units;
    case 'WEEK':
      return units * 7;
    case 'MONTH':
      return units * 30;
    case 'YEAR':
      return units * 365;
    default:
      return null;
  }
}

/** Plan copy from real StoreKit data; trial shown only when eligible. */
export function describePlan(
  priceString: string | null,
  trialDays: number | null
): Pick<MonthlyPlanDetails, 'headline' | 'disclosure'> {
  const per = priceString ? `${priceString}/mo` : 'monthly';
  if (trialDays) {
    const trial = `${trialDays} day${trialDays === 1 ? '' : 's'} free`;
    return {
      headline: `${trial}, then ${per}`,
      disclosure: priceString
        ? `${trial}, then ${priceString} per month. ${RENEW_NOTE}`
        : `${trial}, then monthly. ${RENEW_NOTE}`,
    };
  }
  return {
    headline: priceString ? per : 'Monthly',
    disclosure: priceString
      ? `${priceString} per month. ${RENEW_NOTE}`
      : `Billed monthly. ${RENEW_NOTE}`,
  };
}

/**
 * Localized StoreKit price line for paywall (Guideline 3.1.2(c)).
 * Returns null when RC/product not configured yet.
 */
export async function getMonthlyPriceDisclosure(): Promise<string | null> {
  const plan = await getMonthlyPlanDetails();
  return plan?.disclosure ?? null;
}

/** Plan card data for Paywall / Subscription screens. */
export async function getMonthlyPlanDetails(): Promise<MonthlyPlanDetails | null> {
  if (Platform.OS === 'web') {
    return {
      priceString: null,
      trialDays: 7,
      ...describePlan(null, 7),
      productId: MONTHLY_PRODUCT_ID,
    };
  }
  if (!iosApiKey()) return null;
  try {
    const Purchases = (await import('react-native-purchases')).default;
    const pkg = await resolveMonthlyPackage();
    const price = pkg?.product?.priceString ?? null;
    const id = pkg?.product?.identifier ?? MONTHLY_PRODUCT_ID;
    let trialDays = introTrialDays(pkg?.product?.introPrice);
    if (trialDays) {
      // Apple: one intro offer per subscription group per Apple ID. Only
      // advertise the trial when StoreKit confirms this user can get it.
      try {
        const map = await Purchases.checkTrialOrIntroductoryPriceEligibility([id]);
        const status = map?.[id]?.status;
        // 2 = INTRO_ELIGIBILITY_STATUS_ELIGIBLE
        if (status !== 2) trialDays = null;
      } catch {
        trialDays = null;
      }
    }
    return {
      priceString: price,
      trialDays,
      ...describePlan(price, trialDays),
      productId: id,
    };
  } catch (error) {
    console.warn('getMonthlyPlanDetails failed', error);
    return null;
  }
}

export async function startMonthlyWithTrial(): Promise<SubStatus> {
  if (Platform.OS === 'web') return { ...DEV_ACTIVE };
  if (!iosApiKey()) {
    if (allowDevUnlockWithoutKey()) return { ...DEV_ACTIVE };
    throw new Error(
      'Subscriptions are not configured yet. Add the RevenueCat iOS key for store builds.'
    );
  }
  try {
    const Purchases = (await import('react-native-purchases')).default;
    const pkg = await resolveMonthlyPackage();
    if (!pkg) {
      throw new Error('No subscription package configured in RevenueCat');
    }
    await Purchases.purchasePackage(pkg);
    return getSubscriptionStatus();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/cancel/i.test(msg)) {
      return getSubscriptionStatus();
    }
    throw error;
  }
}

export async function restorePurchases(): Promise<SubStatus> {
  if (Platform.OS === 'web') return { ...DEV_ACTIVE };
  if (!iosApiKey()) {
    if (allowDevUnlockWithoutKey()) return { ...DEV_ACTIVE };
    throw new Error(
      'Subscriptions are not configured yet. Add the RevenueCat iOS key for store builds.'
    );
  }
  const Purchases = (await import('react-native-purchases')).default;
  await configurePurchases();
  await Purchases.restorePurchases();
  return getSubscriptionStatus();
}

/** Opens Apple’s subscription management (RC sheet, else App Store URL). */
export async function openManageSubscriptions(): Promise<void> {
  if (Platform.OS === 'web') {
    await Linking.openURL(APPLE_SUBSCRIPTIONS_URL);
    return;
  }
  if (iosApiKey()) {
    try {
      const Purchases = (await import('react-native-purchases')).default;
      await configurePurchases();
      await Purchases.showManageSubscriptions();
      return;
    } catch (error) {
      console.warn('showManageSubscriptions failed; opening App Store URL', error);
    }
  }
  await Linking.openURL(APPLE_SUBSCRIPTIONS_URL);
}

/** Account deleted / signed out — detach RevenueCat from this user. */
export async function logOutPurchases() {
  knownUserId = null;
  if (Platform.OS === 'web' || !configured || !iosApiKey()) return;
  try {
    const Purchases = (await import('react-native-purchases')).default;
    if (!(await Purchases.isAnonymous())) await Purchases.logOut();
    rcUserId = null;
  } catch (error) {
    console.warn('Purchases logOut failed', error);
  }
}

export function hasPurchasesKey() {
  return Boolean(iosApiKey());
}
