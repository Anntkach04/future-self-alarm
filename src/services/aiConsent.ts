import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, AppState, Linking } from 'react-native';
import { privacyPolicyUrl } from '../config/legal';

/**
 * App Review 5.1.2(i): explicit permission before personal data goes to a
 * third-party AI service. Asked once, before the first voice recording
 * (or the first AI mood note for users who onboarded earlier).
 */
// v2: scope grew from mood notes to the daily wake script (name, habits,
// goals, mood) — earlier consents are asked again.
const CONSENT_KEY = 'fsa.ai_consent.v2';

let cached: boolean | null = null;
let pending: Promise<boolean> | null = null;
/** Everyone waiting on the alert that is (supposedly) on screen. */
let waiters: ((ok: boolean) => void)[] = [];

export async function hasAiConsent(): Promise<boolean> {
  if (cached !== null) return cached;
  try {
    cached = (await AsyncStorage.getItem(CONSENT_KEY)) === 'granted';
  } catch {
    cached = false;
  }
  return cached;
}

async function saveConsent(granted: boolean) {
  cached = granted;
  try {
    if (granted) await AsyncStorage.setItem(CONSENT_KEY, 'granted');
    else await AsyncStorage.removeItem(CONSENT_KEY);
  } catch {
    // ignore — we ask again next time
  }
}

/** Forget consent (account deletion / reset). */
export async function clearAiConsent() {
  await saveConsent(false);
}

function ask(): Promise<boolean> {
  return new Promise((resolve) => {
    const url = privacyPolicyUrl();
    Alert.alert(
      'Your voice & AI services',
      'To create your wake-up voice, your recording is sent to ElevenLabs, which makes a voice clone of you. ' +
        'To write each morning’s message, your name, habits, goals and mood notes are sent to OpenAI. ' +
        'We never sell your data or use it for ads. You can delete your voice anytime.',
      [
        ...(url
          ? [
              {
                text: 'Privacy Policy',
                onPress: () => {
                  void Linking.openURL(url).catch(() => undefined);
                  resolve(false);
                },
              },
            ]
          : []),
        { text: 'Not now', style: 'cancel' as const, onPress: () => resolve(false) },
        {
          text: 'I agree',
          onPress: () => {
            void saveConsent(true);
            resolve(true);
          },
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

// Set once we've re-asked an existing user outside onboarding, so "Not now"
// is not followed by the same alert on every launch.
const REASKED_KEY = 'fsa.ai_consent.v2.reasked';

/**
 * Users who agreed to v1 (before the wake script used OpenAI) never see the
 * v2 prompt again unless they re-record their voice — so every wake message
 * silently became the fixed template ("says the same thing every morning").
 * Ask them once, after onboarding. Resolves with the current consent.
 */
export async function askAiConsentOnceForExistingUser(): Promise<boolean> {
  if (await hasAiConsent()) return true;
  // An alert raised while iOS is still activating the app can be dropped.
  if (AppState.currentState !== 'active') return false;
  try {
    if ((await AsyncStorage.getItem(REASKED_KEY)) === '1') return false;
    await AsyncStorage.setItem(REASKED_KEY, '1');
  } catch {
    return false;
  }
  // Never leave a background caller hanging on an alert iOS didn't show.
  return Promise.race([
    ensureAiConsent(),
    new Promise<boolean>((r) => setTimeout(() => r(cached === true), 60_000)),
  ]);
}

/**
 * Resolves true when the user has agreed (asks once if needed).
 *
 * iOS can silently drop an Alert presented mid-transition (screen push,
 * app becoming active). The promise would then never settle and the mic
 * button looked dead. A visible alert blocks every touch, so a tap that
 * reaches us (`fromTap`) proves no alert is showing: ask again, and hand the
 * answer to everyone still waiting on the lost one.
 */
export async function ensureAiConsent(opts?: { fromTap?: boolean }): Promise<boolean> {
  if (await hasAiConsent()) return true;
  if (pending && !opts?.fromTap) return pending;
  const p = new Promise<boolean>((resolve) => waiters.push(resolve));
  if (!pending || opts?.fromTap) {
    const asked = ask();
    pending = p;
    void asked.then((ok) => {
      // A newer ask replaced this one; its answer wins.
      if (pending !== p) return;
      const all = waiters;
      waiters = [];
      pending = null;
      all.forEach((w) => w(ok));
    });
  }
  return p;
}
