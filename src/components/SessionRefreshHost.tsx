import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAppSettings } from '../context/AppSettingsContext';
import { refreshSessionIfNeeded } from '../services/sessionRefresh';

/**
 * Silent session check on launch / foreground.
 * Never navigates away from Home. Soft-flags reauth only.
 */
export function SessionRefreshHost() {
  const { ready, appleUserId, clearAppleAccount, setSessionReauth } =
    useAppSettings();
  const running = useRef(false);

  useEffect(() => {
    if (!ready) return;

    const run = async () => {
      if (running.current) return;
      running.current = true;
      try {
        const result = await refreshSessionIfNeeded({ appleUserId });
        if (result.status === 'ok' || result.status === 'skipped') {
          setSessionReauth(false);
          return;
        }
        if (result.status === 'offline') {
          return;
        }
        if (result.status === 'revoked') {
          clearAppleAccount();
          setSessionReauth(
            true,
            'Apple Sign In was revoked. Sign in again to restore cloud backup.'
          );
          return;
        }
        if (result.status === 'needs_reauth') {
          setSessionReauth(true, result.reason);
        }
      } catch (error) {
        console.warn('Session refresh failed', error);
      } finally {
        running.current = false;
      }
    };

    void run();

    const onAppState = (next: AppStateStatus) => {
      if (next === 'active') void run();
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => sub.remove();
  }, [ready, appleUserId, clearAppleAccount, setSessionReauth]);

  return null;
}
