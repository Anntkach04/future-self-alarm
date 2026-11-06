import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking } from 'react-native';
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
        'We never sell your data or use it for ads. You can delete your voice anytime in Menu → Account.',
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

/** Resolves true when the user has agreed (asks once if needed). */
export async function ensureAiConsent(): Promise<boolean> {
  if (await hasAiConsent()) return true;
  if (!pending) {
    pending = ask().finally(() => {
      pending = null;
    });
  }
  return pending;
}
