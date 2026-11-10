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
    // Product bought but not yet linked to the entitlement in RevenueCat:
    // the user paid, so treat an active monthly subscription as access.
    if (!ent && info.activeSubscriptions.includes(MONTHLY_PRODUCT_ID)) {
      return {
        active: true,
        inTrial: false,
        expiresAt: info.allExpirationDates?.[MONTHLY_PRODUCT_ID] ?? null,
        productId: MONTHLY_PRODUCT_ID,
        source: 'revenuecat',
      };
    }
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

type PurchasesModule = typeof import('react-native-purchases').default;
type RcPackage = import('react-native-purchases').PurchasesPackage;
type RcProduct = import('react-native-purchases').PurchasesStoreProduct;

/** What the paywall can buy: a RevenueCat package, or the raw StoreKit product. */
type MonthlyPlan = { pkg: RcPackage | null; product: RcProduct };

/** Why the price could not load (shown on the paywall so setup issues are visible). */
let lastPlanProblem: string | null = null;
export function planProblem() {
  return lastPlanProblem;
}

function errorText(error: unknown) {
  if (error && typeof error === 'object') {
    const e = error as { code?: unknown; message?: unknown; underlyingErrorMessage?: unknown };
    const parts = [e.code != null ? `code ${String(e.code)}` : '', String(e.message ?? ''), String(e.underlyingErrorMessage ?? '')]
      .map((x) => x.trim())
      .filter(Boolean);
    if (parts.length) return parts.join(' · ');
  }
  return String(error);
}

function pickMonthly(packages: RcPackage[]) {
  return (
    packages.find(
      (p) =>
        p.product.identifier === MONTHLY_PRODUCT_ID ||
        p.identifier === MONTHLY_PRODUCT_ID
    ) ??
    packages.find((p) => p.packageType === 'MONTHLY') ??
    packages.find(
      (p) => (p.product as { subscriptionPeriod?: string | null }).subscriptionPeriod === 'P1M'
    ) ??
    // The app sells exactly one plan: a lone package is that plan.
    (packages.length === 1 ? packages[0] : undefined)
  );
}

/**
 * RevenueCat offering first (current, then any). If the dashboard has no
 * usable offering, ask StoreKit for the product directly so a RevenueCat
 * setup slip never blocks a purchase that Apple can serve.
 */
async function resolveMonthlyPlan(Purchases: PurchasesModule): Promise<MonthlyPlan | null> {
  await configurePurchases();
  let offeringsProblem = '';
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current?.availablePackages ?? [];
    const all = Object.values(offerings.all ?? {}).flatMap(
      (o) => o.availablePackages ?? []
    );
    for (const packages of [current, all]) {
      const pkg = pickMonthly(packages);
      if (pkg) {
        lastPlanProblem = null;
        return { pkg, product: pkg.product };
      }
    }
    offeringsProblem = `RevenueCat offerings: ${Object.keys(offerings.all ?? {}).join(', ') || 'none'}`;
  } catch (error) {
    offeringsProblem = `RevenueCat: ${errorText(error)}`;
  }
  try {
    const products = await Purchases.getProducts(
      [MONTHLY_PRODUCT_ID],
      Purchases.PRODUCT_CATEGORY.SUBSCRIPTION
    );
    const product = products.find((p) => p.identifier === MONTHLY_PRODUCT_ID) ?? products[0];
    if (product) {
      lastPlanProblem = null;
      return { pkg: null, product };
    }
    lastPlanProblem = `${offeringsProblem}. App Store returned no product "${MONTHLY_PRODUCT_ID}".`;
  } catch (error) {
    lastPlanProblem = `${offeringsProblem}. App Store: ${errorText(error)}`;
  }
  console.warn('Monthly plan unavailable:', lastPlanProblem);
  return null;
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

const RENEW_NOTE = 'Auto-renews monthly until you cancel.';

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
    headline: priceString ? per : '',
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
    const plan = await resolveMonthlyPlan(Purchases);
    const price = plan?.product.priceString ?? null;
    const id = plan?.product.identifier ?? MONTHLY_PRODUCT_ID;
    let trialDays = introTrialDays(plan?.product.introPrice);
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
    lastPlanProblem = errorText(error);
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
    const plan = await resolveMonthlyPlan(Purchases);
    if (!plan) {
      throw new Error('The App Store did not return the monthly plan. Try again in a moment.');
    }
    if (plan.pkg) await Purchases.purchasePackage(plan.pkg);
    else await Purchases.purchaseStoreProduct(plan.product);
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
