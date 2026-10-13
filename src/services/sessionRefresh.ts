import { Platform } from 'react-native';
import {
  clearApiSession,
  getSessionToken,
  signInWithAppleOnServer,
} from './apiAuth';
import { getApiUrl } from './elevenlabs';

export type SessionRefreshResult =
  | { status: 'ok' }
  | { status: 'skipped' }
  | { status: 'offline' }
  | { status: 'needs_reauth'; reason: string }
  | { status: 'revoked' };

async function probeMe(token: string): Promise<'ok' | 'unauthorized' | 'offline'> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${getApiUrl()}/api/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (response.status === 401) return 'unauthorized';
    if (!response.ok) return 'offline';
    return 'ok';
  } catch {
    return 'offline';
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Keep Home offline-first. Only clears a dead JWT; never wipes local profile/alarms.
 * Apple does not give a silent identityToken refresh — if JWT is dead but the
 * Apple credential is still authorized, we mark soft reauth (banner), not logout.
 */
export async function refreshSessionIfNeeded(input: {
  appleUserId: string | null;
}): Promise<SessionRefreshResult> {
  const appleUserId = input.appleUserId?.trim() || null;
  if (!appleUserId) return { status: 'skipped' };

  const token = await getSessionToken();
  if (!token) {
    return {
      status: 'needs_reauth',
      reason: 'No API session. Reconnect Apple for cloud sync.',
    };
  }

  const probe = await probeMe(token);
  if (probe === 'ok') return { status: 'ok' };
  if (probe === 'offline') return { status: 'offline' };

  // Token rejected — drop it so we don't keep sending a bad Bearer.
  await clearApiSession();

  if (Platform.OS !== 'ios') {
    return {
      status: 'needs_reauth',
      reason: 'Session expired. Sign in again when you can.',
    };
  }

  try {
    const AppleAuthentication = await import('expo-apple-authentication');
    const available = await AppleAuthentication.isAvailableAsync();
    if (!available) {
      return {
        status: 'needs_reauth',
        reason: 'Session expired. Sign in with Apple when you can.',
      };
    }

    const state = await AppleAuthentication.getCredentialStateAsync(appleUserId);
    if (
      state === AppleAuthentication.AppleAuthenticationCredentialState.REVOKED ||
      state === AppleAuthentication.AppleAuthenticationCredentialState.NOT_FOUND
    ) {
      return { status: 'revoked' };
    }

    // AUTHORIZED but no silent token API — soft reauth only.
    return {
      status: 'needs_reauth',
      reason: 'Session expired. Reconnect Apple to keep cloud backup working.',
    };
  } catch {
    return {
      status: 'needs_reauth',
      reason: 'Session expired. Reconnect Apple when you can.',
    };
  }
}

/** Interactive reconnect (shows Apple sheet). Call from banner CTA. */
export async function reconnectAppleSession(): Promise<{
  ok: boolean;
  userId?: string;
  email?: string | null;
}> {
  if (Platform.OS !== 'ios') {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      const id = `dev_${Date.now()}`;
      const result = await signInWithAppleOnServer({
        identityToken: `dev.${id}`,
        email: null,
      });
      return { ok: true, userId: result.user.id, email: result.user.email };
    }
    return { ok: false };
  }

  const AppleAuthentication = await import('expo-apple-authentication');
  const cred = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!cred.identityToken) return { ok: false };
  const result = await signInWithAppleOnServer({
    identityToken: cred.identityToken,
    email: cred.email ?? null,
  });
  return {
    ok: true,
    userId: cred.user || result.user.id,
    email: cred.email ?? result.user.email,
  };
}
