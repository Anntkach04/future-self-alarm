import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAppSettings } from '../context/AppSettingsContext';
import { useOnboarding } from '../context/OnboardingContext';
import { navigationRef } from '../navigation/navigationRef';
import type { RootStackParamList } from '../navigation/types';
import {
  configurePurchases,
  getSubscriptionStatus,
  hasPurchasesKey,
  setPurchasesUserId,
} from '../services/subscriptions';

/**
 * Screens a lapsed subscriber may still open from the gated paywall
 * (account management / deletion — App Review 5.1.1(v)).
 */
const ALLOWED_WHILE_LOCKED = new Set<keyof RootStackParamList>([
  'Paywall',
  'EditProfile',
  'EditProfileName',
  'ProfileFieldEdit',
  'Welcome',
  'Intro',
  'SignIn',
]);

function currentRouteName() {
  if (!navigationRef.isReady()) return null;
  return (navigationRef.getCurrentRoute()?.name ?? null) as
    | keyof RootStackParamList
    | null;
}

/** Replace the whole stack so Back / swipe cannot return to Home. */
function lockToPaywall() {
  if (!navigationRef.isReady()) return;
  const route = navigationRef.getCurrentRoute();
  if (
    route?.name === 'Paywall' &&
    (route.params as RootStackParamList['Paywall'])?.gated
  ) {
    return;
  }
  navigationRef.reset({
    index: 0,
    routes: [{ name: 'Paywall', params: { gated: true } }],
  });
}

/**
 * When RevenueCat is configured and onboarding is done, send expired /
 * non-subscribers to a paywall they cannot back out of. Skips local builds
 * without an RC key.
 */
export function EntitlementGateHost() {
  const { onboardingComplete, ready } = useOnboarding();
  const { appleUserId, ready: settingsReady } = useAppSettings();
  const checking = useRef(false);

  // Identify the RevenueCat user before anything else touches Purchases, so
  // relaunches never create a fresh anonymous customer.
  useEffect(() => {
    if (!settingsReady) return;
    setPurchasesUserId(appleUserId);
    if (appleUserId && hasPurchasesKey()) {
      void configurePurchases(appleUserId);
    }
  }, [appleUserId, settingsReady]);
  const locked = useRef(false);

  useEffect(() => {
    if (!ready || !onboardingComplete || !hasPurchasesKey()) {
      locked.current = false;
      return;
    }

    const check = async () => {
      if (checking.current) return;
      checking.current = true;
      try {
        const status = await getSubscriptionStatus();
        if (status.active) {
          locked.current = false;
          return;
        }
        // Only gate on a clear "not entitled" from RevenueCat. Network blips
        // return source "none" — don't kick someone offline to the paywall.
        if (status.source === 'revenuecat') {
          locked.current = true;
          lockToPaywall();
        }
      } catch (error) {
        console.warn('Entitlement check failed', error);
      } finally {
        checking.current = false;
      }
    };

    void check();

    const onAppState = (next: AppStateStatus) => {
      if (next === 'active') void check();
    };
    const appSub = AppState.addEventListener('change', onAppState);

    // While locked, any route outside account management re-checks (the user
    // may just have purchased) and bounces back to the gated paywall.
    const unsubscribeNav = navigationRef.addListener('state', () => {
      if (!locked.current) return;
      const name = currentRouteName();
      if (!name || ALLOWED_WHILE_LOCKED.has(name)) return;
      void check();
    });

    return () => {
      appSub.remove();
      unsubscribeNav();
    };
  }, [onboardingComplete, ready]);

  return null;
}
