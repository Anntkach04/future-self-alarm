import { Linking, Platform } from 'react-native';

const APPLE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

/** Entitlement id configured in RevenueCat (+ App Store Connect later). */
export const ENTITLEMENT_ID = 'future_self_alarm_pro';

/** Preferred product id — match RevenueCat / App Store when linking. */
export const MONTHLY_PRODUCT_ID = 'futureself_plus_monthly';
/** Yearly plan, same subscription group and entitlement. */
export const ANNUAL_PRODUCT_ID = 'futureself_plus_annual';

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
    // the user paid, so treat an active plan as access.
    const paidId = [MONTHLY_PRODUCT_ID, ANNUAL_PRODUCT_ID].find((id) =>
      info.activeSubscriptions.includes(id)
    );
    if (!ent && paidId) {
      return {
        active: true,
        inTrial: false,
        expiresAt: info.allExpirationDates?.[paidId] ?? null,
        productId: paidId,
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

export type PlanKind = 'monthly' | 'annual';

/** What the paywall can buy: a RevenueCat package, or the raw StoreKit product. */
type StorePlan = { pkg: RcPackage | null; product: RcProduct };
type StorePlans = Partial<Record<PlanKind, StorePlan>>;

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

const PRODUCT_ID: Record<PlanKind, string> = {
  monthly: MONTHLY_PRODUCT_ID,
  annual: ANNUAL_PRODUCT_ID,
};
const PACKAGE_TYPE: Record<PlanKind, string> = { monthly: 'MONTHLY', annual: 'ANNUAL' };
const PERIOD: Record<PlanKind, string> = { monthly: 'P1M', annual: 'P1Y' };

function periodOf(p: RcProduct) {
  return (p as { subscriptionPeriod?: string | null }).subscriptionPeriod ?? null;
}

function pickPackage(packages: RcPackage[], kind: PlanKind) {
  return (
    packages.find(
      (p) => p.product.identifier === PRODUCT_ID[kind] || p.identifier === PRODUCT_ID[kind]
    ) ??
    packages.find((p) => p.packageType === PACKAGE_TYPE[kind]) ??
    packages.find((p) => periodOf(p.product) === PERIOD[kind])
  );
}

/**
 * RevenueCat offering first (current, then any). If the dashboard has no
 * usable offering, ask StoreKit for the products directly so a RevenueCat
 * setup slip never blocks a purchase that Apple can serve.
 */
async function resolvePlans(Purchases: PurchasesModule): Promise<StorePlans> {
  await configurePurchases();
  const plans: StorePlans = {};
  let offeringsProblem = '';
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current?.availablePackages ?? [];
    const all = Object.values(offerings.all ?? {}).flatMap(
      (o) => o.availablePackages ?? []
    );
    for (const kind of ['monthly', 'annual'] as PlanKind[]) {
      const pkg = pickPackage(current, kind) ?? pickPackage(all, kind);
      if (pkg) plans[kind] = { pkg, product: pkg.product };
    }
    if (!plans.monthly && !plans.annual) {
      offeringsProblem = `RevenueCat offerings: ${Object.keys(offerings.all ?? {}).join(', ') || 'none'}`;
    }
  } catch (error) {
    offeringsProblem = `RevenueCat: ${errorText(error)}`;
  }
  const missing = (['monthly', 'annual'] as PlanKind[]).filter((k) => !plans[k]);
  if (missing.length) {
    try {
      const products = await Purchases.getProducts(
        missing.map((k) => PRODUCT_ID[k]),
        Purchases.PRODUCT_CATEGORY.SUBSCRIPTION
      );
      for (const kind of missing) {
        const product = products.find((p) => p.identifier === PRODUCT_ID[kind]);
        if (product) plans[kind] = { pkg: null, product };
      }
    } catch (error) {
      offeringsProblem = `${offeringsProblem}. App Store: ${errorText(error)}`;
    }
  }
  lastPlanProblem =
    plans.monthly || plans.annual
      ? null
      : `${offeringsProblem}. App Store returned no "${MONTHLY_PRODUCT_ID}" or "${ANNUAL_PRODUCT_ID}".`;
  if (lastPlanProblem) console.warn('Plans unavailable:', lastPlanProblem);
  return plans;
}

export type PlanDetails = {
  kind: PlanKind;
  productId: string;
  /** Localized StoreKit price, e.g. "$69.99" */
  priceString: string | null;
  /** Annual only: localized price per month, e.g. "$5.83" */
  perMonthString: string | null;
  /**
   * Free-trial length THIS Apple ID can still get, else null (no trial
   * offer, already used, or unknown). Never promise a trial we can't give.
   */
  trialDays: number | null;
  /** Full disclosure line for App Review 3.1.2(c) */
  disclosure: string;
};

export type PlanOptions = {
  monthly: PlanDetails | null;
  annual: PlanDetails | null;
  /** Annual vs 12 × monthly, whole percent; null if unknown. */
  annualSavingsPercent: number | null;
};

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

/** Plan disclosure from real StoreKit data; trial named only when eligible. */
export function describePlan(
  kind: PlanKind,
  priceString: string | null,
  trialDays: number | null
) {
  const unit = kind === 'annual' ? 'year' : 'month';
  const renew = `Auto-renews ${kind === 'annual' ? 'yearly' : 'monthly'} until you cancel.`;
  const price = priceString ? `${priceString} per ${unit}` : `Billed ${kind === 'annual' ? 'yearly' : 'monthly'}`;
  if (trialDays) {
    const trial = `${trialDays} day${trialDays === 1 ? '' : 's'} free`;
    return `${trial}, then ${price}. ${renew}`;
  }
  return `${price}. ${renew}`;
}

function webPlans(): PlanOptions {
  return {
    monthly: { kind: 'monthly', productId: MONTHLY_PRODUCT_ID, priceString: '$9.99', perMonthString: null, trialDays: null, disclosure: describePlan('monthly', '$9.99', null) },
    annual: { kind: 'annual', productId: ANNUAL_PRODUCT_ID, priceString: '$69.99', perMonthString: '$5.83', trialDays: 7, disclosure: describePlan('annual', '$69.99', 7) },
    annualSavingsPercent: 42,
  };
}

/** Both plans for the Paywall / Subscription screens. */
export async function getPlanOptions(): Promise<PlanOptions | null> {
  if (Platform.OS === 'web') return webPlans();
  if (!iosApiKey()) return null;
  try {
    const Purchases = (await import('react-native-purchases')).default;
    const plans = await resolvePlans(Purchases);
    const kinds = (['monthly', 'annual'] as PlanKind[]).filter((k) => plans[k]);
    const ids = kinds.map((k) => plans[k]!.product.identifier);
    let eligibility: Record<string, { status?: number }> = {};
    try {
      // Apple: one intro offer per subscription group per Apple ID. Only
      // advertise a trial when StoreKit confirms this user can get it.
      eligibility = (await Purchases.checkTrialOrIntroductoryPriceEligibility(ids)) as typeof eligibility;
    } catch {
      eligibility = {};
    }
    const details = (kind: PlanKind): PlanDetails | null => {
      const plan = plans[kind];
      if (!plan) return null;
      const p = plan.product;
      let trialDays = introTrialDays(p.introPrice);
      // 2 = INTRO_ELIGIBILITY_STATUS_ELIGIBLE
      if (trialDays && eligibility[p.identifier]?.status !== 2) trialDays = null;
      const priceString = p.priceString ?? null;
      return {
        kind,
        productId: p.identifier,
        priceString,
        perMonthString: kind === 'annual' ? p.pricePerMonthString ?? null : null,
        trialDays,
        disclosure: describePlan(kind, priceString, trialDays),
      };
    };
    const monthly = details('monthly');
    const annual = details('annual');
    const m = plans.monthly?.product;
    const a = plans.annual?.product;
    const annualSavingsPercent =
      m && a && m.currencyCode === a.currencyCode && m.price > 0
        ? Math.floor((1 - a.price / (m.price * 12)) * 100)
        : null;
    return {
      monthly,
      annual,
      annualSavingsPercent:
        annualSavingsPercent != null && annualSavingsPercent > 0 ? annualSavingsPercent : null,
    };
  } catch (error) {
    lastPlanProblem = errorText(error);
    console.warn('getPlanOptions failed', error);
    return null;
  }
}

export async function purchasePlan(kind: PlanKind): Promise<SubStatus> {
  if (Platform.OS === 'web') return { ...DEV_ACTIVE };
  if (!iosApiKey()) {
    if (allowDevUnlockWithoutKey()) return { ...DEV_ACTIVE };
    throw new Error(
      'Subscriptions are not configured yet. Add the RevenueCat iOS key for store builds.'
    );
  }
  try {
    const Purchases = (await import('react-native-purchases')).default;
    const plan = (await resolvePlans(Purchases))[kind];
    if (!plan) {
      throw new Error(`The App Store did not return the ${kind} plan. Try again in a moment.`);
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
