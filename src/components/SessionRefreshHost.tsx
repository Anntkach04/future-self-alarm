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
  // Callbacks via refs: they are re-created on every settings update, and as
  // effect deps they re-ran this check after each result — an endless
  // /api/me loop (~27 requests a second).
  const clearRef = useRef(clearAppleAccount);
  const reauthRef = useRef(setSessionReauth);
  clearRef.current = clearAppleAccount;
  reauthRef.current = setSessionReauth;

  useEffect(() => {
    if (!ready) return;

    const run = async () => {
      if (running.current) return;
      running.current = true;
      try {
        const result = await refreshSessionIfNeeded({ appleUserId });
        const setSessionReauth = reauthRef.current;
        if (result.status === 'ok' || result.status === 'skipped') {
          setSessionReauth(false);
          return;
        }
        if (result.status === 'offline') {
          return;
        }
        if (result.status === 'revoked') {
          clearRef.current();
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
  }, [ready, appleUserId]);

  return null;
}
