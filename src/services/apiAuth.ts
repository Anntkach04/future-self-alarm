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
  const response = await fetch(`${base}/api/auth/apple`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identityToken: input.identityToken,
      email: input.email ?? null,
      fullName: input.fullName ?? null,
      authorizationCode: input.authorizationCode ?? null,
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
  if (data.token) {
    await setSessionToken(data.token);
  }
  if (!data.user) {
    throw new Error('Server returned no user');
  }
  return {
    token: data.token ?? null,
    user: data.user,
    authRequired: Boolean(data.authRequired),
  };
}

/**
 * Anonymous JWT so clone/TTS works before the Sign in with Apple screen.
 * No-op if a session already exists or the server does not enforce auth.
 */
export async function ensureGuestSession(): Promise<void> {
  const existing = await getSessionToken();
  if (existing) return;

  const { getApiUrl } = await import('./elevenlabs');
  const base = getApiUrl();
  const response = await fetch(`${base}/api/auth/guest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    token?: string | null;
    authRequired?: boolean;
  };
  if (!response.ok) {
    throw new Error(data.error || 'Could not start guest session');
  }
  if (data.token) {
    await setSessionToken(data.token);
  }
}

export async function clearApiSession() {
  await setSessionToken(null);
}

/** App Store 5.1.1(v) — delete server account + local session. */
export async function deleteAccountOnServer(): Promise<void> {
  const { getApiUrl } = await import('./elevenlabs');
  const base = getApiUrl();
  const response = await fetch(`${base}/api/me`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(data.error || `Could not delete account (${response.status})`);
  }
  await clearApiSession();
}
