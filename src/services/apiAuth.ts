import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/** Legacy AsyncStorage key — migrated once into Keychain / SecureStore. */
const TOKEN_KEY_LEGACY = 'fsa.api_session.v1';
const TOKEN_KEY_SECURE = 'fsa.api_session.v1';

let memoryToken: string | null = null;
let loaded = false;

export type ApiUser = {
  id: string;
  email: string | null;
  voiceId: string | null;
  profile: Record<string, unknown>;
};

async function secureStore() {
  if (Platform.OS === 'web') return null;
  try {
    return await import('expo-secure-store');
  } catch {
    return null;
  }
}

async function readPersistedToken(): Promise<string | null> {
  const secure = await secureStore();
  if (secure) {
    try {
      const fromKeychain = await secure.getItemAsync(TOKEN_KEY_SECURE);
      if (fromKeychain) return fromKeychain;
    } catch {
      // fall through to legacy
    }
  }

  try {
    const legacy = await AsyncStorage.getItem(TOKEN_KEY_LEGACY);
    if (legacy) {
      // One-time migrate into Keychain, then drop plaintext copy.
      if (secure) {
        try {
          await secure.setItemAsync(TOKEN_KEY_SECURE, legacy);
          await AsyncStorage.removeItem(TOKEN_KEY_LEGACY);
        } catch {
          // Keep legacy if Keychain write fails (simulator edge cases).
        }
      }
      return legacy;
    }
  } catch {
    // ignore
  }
  return null;
}

async function writePersistedToken(token: string | null) {
  const secure = await secureStore();
  if (token) {
    if (secure) {
      try {
        await secure.setItemAsync(TOKEN_KEY_SECURE, token);
        await AsyncStorage.removeItem(TOKEN_KEY_LEGACY).catch(() => {});
        return;
      } catch {
        // fall back below
      }
    }
    await AsyncStorage.setItem(TOKEN_KEY_LEGACY, token).catch(() => {});
    return;
  }

  if (secure) {
    try {
      await secure.deleteItemAsync(TOKEN_KEY_SECURE);
    } catch {
      // ignore
    }
  }
  await AsyncStorage.removeItem(TOKEN_KEY_LEGACY).catch(() => {});
}

async function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  memoryToken = await readPersistedToken();
}

export async function getSessionToken(): Promise<string | null> {
  await ensureLoaded();
  return memoryToken;
}

export async function setSessionToken(token: string | null) {
  memoryToken = token;
  loaded = true;
  await writePersistedToken(token);
}

export async function authHeaders(
  extra?: Record<string, string>
): Promise<Record<string, string>> {
  const token = await getSessionToken();
  return {
    ...(extra || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function signInWithAppleOnServer(input: {
  identityToken: string;
  email?: string | null;
  fullName?: string | null;
  /** Native Apple authorization code — used server-side to store refresh token for revoke-on-delete. */
  authorizationCode?: string | null;
}): Promise<{ token: string | null; user: ApiUser; authRequired: boolean }> {
  // Lazy import avoids a cycle with elevenlabs.apiFetch → authHeaders.
  const { getApiUrl } = await import('./elevenlabs');
  const base = getApiUrl();
  // Guest session (if any) lets the server move voices cloned before Sign in
  // onto the Apple account — ownership checks and deletion depend on it.
  const guestToken = await getSessionToken();
  const response = await fetch(`${base}/api/auth/apple`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identityToken: input.identityToken,
      email: input.email ?? null,
      fullName: input.fullName ?? null,
      authorizationCode: input.authorizationCode ?? null,
      guestToken: guestToken || null,
    }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    token?: string | null;
    user?: ApiUser;
    authRequired?: boolean;
  };
  if (!response.ok) {
    throw new Error(data.error || 'Apple sign-in failed on server');
  }
  if (!data.user?.id) {
    throw new Error('Server returned no user');
  }
  if (typeof data.token !== 'string' || !data.token.trim()) {
    throw new Error('Server returned no session. Please try signing in again.');
  }
  await setSessionToken(data.token);
  return {
    token: data.token ?? null,
    user: data.user,
    authRequired: Boolean(data.authRequired),
  };
}

/**
 * Anonymous JWT so clone/TTS works before / without Apple.
 * Soft-fail: never blocks onboarding if the API is slow or down.
 * @returns true when a session token is available
 */
export async function ensureGuestSession(
  opts: { force?: boolean } = {}
): Promise<boolean> {
  try {
    if (opts.force) {
      await setSessionToken(null);
    } else {
      const existing = await getSessionToken();
      if (existing) return true;
    }

    const { getApiUrl } = await import('./elevenlabs');
    const base = getApiUrl();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    let response: Response;
    try {
      response = await fetch(`${base}/api/auth/guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      token?: string | null;
    };
    if (!response.ok) {
      console.warn('Guest session failed', data.error || response.status);
      return false;
    }
    if (data.token) {
      await setSessionToken(data.token);
      return true;
    }
    return false;
  } catch (error) {
    console.warn('Guest session error', error);
    return false;
  }
}

export async function clearApiSession() {
  await setSessionToken(null);
}

/**
 * App Store 5.1.1(v) — delete server account + clear local session.
 * Keep the session on failure so the user can retry or reconnect.
 * Only a confirmed deletion or a missing account permits the local wipe.
 */
export async function deleteAccountOnServer(): Promise<void> {
  const token = await getSessionToken();
  if (!token) {
    throw new Error('Sign in again before deleting your account.');
  }

  const { getApiUrl } = await import('./elevenlabs');
  const base = getApiUrl();
  let response: Response;
  try {
    response = await fetch(`${base}/api/me`, {
      method: 'DELETE',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
    });
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error('Could not reach the server to delete your account.');
  }

  if (response.status === 401) {
    throw new Error('Session expired. Sign in again before deleting your account.');
  }

  if (response.status === 404) {
    await clearApiSession();
    return;
  }

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(
      data.error || `Could not delete account (${response.status})`
    );
  }

  await clearApiSession();
}
