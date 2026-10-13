import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useOnboarding } from '../context/OnboardingContext';
import { navigateRoot } from '../navigation/navigationRef';
import {
  getSubscriptionStatus,
  hasPurchasesKey,
} from '../services/subscriptions';

/**
 * When RevenueCat is configured and onboarding is done, send expired /
 * non-subscribers back to the paywall. Skips local builds without an RC key.
 */
export function EntitlementGateHost() {
  const { onboardingComplete, ready } = useOnboarding();
  const checking = useRef(false);

  useEffect(() => {
    if (!ready || !onboardingComplete || !hasPurchasesKey()) return;

    const check = async () => {
      if (checking.current) return;
      checking.current = true;
      try {
        const status = await getSubscriptionStatus();
        // Only gate on a clear "not entitled" from RevenueCat. Network blips
        // return source "none" — don't kick someone offline to the paywall.
        if (!status.active && status.source === 'revenuecat') {
          navigateRoot('Paywall');
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
    const sub = AppState.addEventListener('change', onAppState);
    return () => sub.remove();
  }, [onboardingComplete, ready]);

  return null;
}
