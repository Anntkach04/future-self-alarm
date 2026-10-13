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

function iosApiKey() {
  return process.env.EXPO_PUBLIC_REVENUECAT_IOS?.trim() || '';
}

/** Metro / simulator only — never unlock paid features in Release without RC. */
function allowDevUnlockWithoutKey() {
  return typeof __DEV__ !== 'undefined' && __DEV__ && !iosApiKey();
}

export async function configurePurchases(appUserId?: string | null) {
  if (Platform.OS === 'web') return false;
  const key = iosApiKey();
  if (!key) return false;
  try {
    const Purchases = (await import('react-native-purchases')).default;
    if (!configured) {
      Purchases.configure({
        apiKey: key,
        appUserID: appUserId || undefined,
      });
      configured = true;
    } else if (appUserId) {
      await Purchases.logIn(appUserId);
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
    packages.find(
      (p) => p.packageType === 'MONTHLY' || p.identifier.includes('month')
    ) ??
    packages[0] ??
    null
  );
}

/**
 * Localized StoreKit price line for paywall (Guideline 3.1.2(c)).
 * Returns null when RC/product not configured yet.
 */
export async function getMonthlyPriceDisclosure(): Promise<string | null> {
  if (Platform.OS === 'web' || !iosApiKey()) return null;
  try {
    const pkg = await resolveMonthlyPackage();
    if (!pkg?.product?.priceString) return null;
    const price = pkg.product.priceString;
    return `7 days free, then ${price} per month. Auto-renews until canceled in Apple ID → Subscriptions.`;
  } catch (error) {
    console.warn('getMonthlyPriceDisclosure failed', error);
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

export function hasPurchasesKey() {
  return Boolean(iosApiKey());
}
