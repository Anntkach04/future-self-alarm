import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { BackButton } from '../components/BackButton';
import { LegalLinks } from '../components/LegalLinks';
import { Screen } from '../components/Screen';
import { useAppSettings } from '../context/AppSettingsContext';
import { useMoodCheckIn } from '../context/MoodCheckInContext';
import { useOnboarding } from '../context/OnboardingContext';
import { RootStackParamList } from '../navigation/types';
import { signInWithAppleOnServer } from '../services/apiAuth';
import {
  buildCloudProfile,
  fetchCloudBundle,
  pushCloudProfile,
  shouldPreferCloud,
} from '../services/profileSync';
import { configurePurchases } from '../services/subscriptions';
import { userFacingError } from '../services/userFacingError';
import { colors, fonts, noFakeBold, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'SignIn'>;

const COPY = {
  save: {
    title: 'Keep your\nfuture voice',
    body: 'Sign in with Apple so your voice and alarms are saved — even if you change phones.',
  },
  restore: {
    title: 'Welcome\nback',
    body: 'Sign in with the same Apple ID to bring back your voice and alarms.',
  },
  resume: {
    title: 'One quick\nstep',
    body: 'Sign in with Apple so we can finish creating your voice.',
  },
} as const;

const SAVED_ITEMS = [
  'Your cloned voice',
  'Your alarms and wake-up messages',
  'Your answers, so mornings stay personal',
];

export function SignInScreen({ navigation, route }: Props) {
  const mode = route.params?.mode ?? 'restore';
  const copy = COPY[mode];
  const {
    setAppleAccount,
    voiceLevel,
    bedLevel,
    setMixLevels,
    setSessionReauth,
    notificationsReady,
    alarmKitReady,
  } = useAppSettings();
  const {
    answers,
    voice,
    onboardingComplete,
    hydrateFromCloud,
    setName,
  } = useOnboarding();
  const { today, hydrateMood } = useMoodCheckIn();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** New account: continue wherever this sign-in was asked from. */
  const goOnboarding = () => {
    if (mode === 'save') {
      navigation.replace(
        !notificationsReady || !alarmKitReady ? 'AlarmPermission' : 'Paywall'
      );
      return;
    }
    if (mode === 'resume') {
      navigation.replace('VoiceRecord');
      return;
    }
    navigation.navigate('Name');
  };

  const goHome = () => {
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  /** @returns true when a finished cloud profile was restored */
  const syncCloudAfterSignIn = async (): Promise<boolean> => {
    try {
      const bundle = await fetchCloudBundle();
      if (!bundle) {
        await pushCloudProfile(
          buildCloudProfile({
            answers,
            voice,
            onboardingComplete,
            mood: today,
            mix: { voiceLevel, bedLevel },
          })
        );
        return false;
      }

      const cloud = bundle.profile;
      const preferCloud = shouldPreferCloud(
        {
          onboardingComplete,
          voiceId: voice.voiceId,
          hasName: Boolean(answers.name.trim()),
        },
        cloud,
        bundle.user.voiceId
      );

      if (preferCloud && cloud) {
        hydrateFromCloud({
          answers: cloud.answers,
          voiceId: cloud.voiceId || bundle.user.voiceId,
          isDemoVoice: cloud.isDemoVoice,
          onboardingComplete: true,
        });
        if (cloud.mood) hydrateMood(cloud.mood);
        if (cloud.mix) setMixLevels(cloud.mix.voiceLevel, cloud.mix.bedLevel);
        return Boolean(
          cloud.onboardingComplete || cloud.voiceId || bundle.user.voiceId
        );
      }

      if (preferCloud && !cloud && bundle.user.voiceId) {
        hydrateFromCloud({
          answers: {},
          voiceId: bundle.user.voiceId,
          onboardingComplete: true,
        });
        return true;
      }

      await pushCloudProfile(
        buildCloudProfile({
          answers,
          voice,
          onboardingComplete,
          mood: today,
          mix: { voiceLevel, bedLevel },
        })
      );
      return false;
    } catch (err) {
      console.warn('Cloud profile sync failed', err);
      return false;
    }
  };

  const registerOnServer = async (input: {
    identityToken: string;
    userId: string;
    email?: string | null;
    authorizationCode?: string | null;
  }) => {
    await signInWithAppleOnServer({
      identityToken: input.identityToken,
      email: input.email ?? null,
      authorizationCode: input.authorizationCode ?? null,
    });
    const restored = await syncCloudAfterSignIn();
    setAppleAccount(input.userId, input.email ?? null);
    setSessionReauth(false);
    await configurePurchases(input.userId);
    return restored;
  };

  const signInWithApple = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      if (Platform.OS !== 'ios') {
        setError('Sign in with Apple is available on iPhone.');
        return;
      }

      const AppleAuthentication = await import('expo-apple-authentication');
      const available = await AppleAuthentication.isAvailableAsync();
      if (!available) {
        setError('Sign in with Apple is not available on this device.');
        return;
      }
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!cred.identityToken) {
        throw new Error('Apple did not return an identity token');
      }
      const appleName = [cred.fullName?.givenName, cred.fullName?.familyName]
        .filter(Boolean)
        .join(' ')
        .trim();
      // Never overwrite a name the user already typed.
      const typedName = answers.name.trim();
      if (appleName && !typedName) setName(appleName);
      else if (!appleName && cred.email) {
        const local = String(cred.email).split('@')[0]?.trim();
        if (local && !answers.name.trim()) setName(local);
      }
      const restored = await registerOnServer({
        identityToken: cred.identityToken,
        userId: cred.user,
        email: cred.email ?? null,
        authorizationCode: cred.authorizationCode ?? null,
      });
      if (restored) goHome();
      else goOnboarding();
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'ERR_REQUEST_CANCELED') return;
      console.warn('Apple Sign In failed', err);
      const raw = err instanceof Error ? err.message : String(err);
      setError(
        /RequestUnknown|authorization attempt failed/i.test(raw)
          ? 'Apple Sign In did not finish. Try again in a moment.'
          : userFacingError(err, 'Could not sign in with Apple. Try again.')
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <BackButton style={styles.back} />
      <Text maxFontSizeMultiplier={1.2} style={styles.title}>{copy.title}</Text>
      <Text maxFontSizeMultiplier={1.5} style={styles.body}>{copy.body}</Text>
      {mode === 'save' ? (
        <View style={styles.savedList}>
          {SAVED_ITEMS.map((item) => (
            <View key={item} style={styles.savedRow}>
              <View style={styles.savedDot} />
              <Text maxFontSizeMultiplier={1.5} style={styles.savedText}>{item}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {error ? <Text maxFontSizeMultiplier={1.5} style={styles.error}>{error}</Text> : null}
      <LegalLinks style={styles.legal} />

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => void signInWithApple()}
          style={[styles.appleBtn, busy && styles.appleBtnDisabled]}
          disabled={busy}
        >
          <View style={styles.appleBtnInner}>
            <Svg width={18} height={22} viewBox="0 0 18 22" fill="none">
              <Path
                d="M14.7 11.6c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.7-1.3-.1-2.5.8-3.1.8-.6 0-1.6-.7-2.7-.7-1.4 0-2.7.8-3.4 2.1-1.5 2.5-.4 6.3 1 8.4.7 1 1.5 2.2 2.6 2.1 1 0 1.4-.7 2.7-.7s1.6.7 2.7.7c1.1 0 1.8-1 2.5-2 .8-1.1 1.1-2.2 1.1-2.3-.1 0-2.1-.8-2.2-3.5zM12.2 4.8c.6-.7 1-1.7.9-2.7-0.9.1-1.9.6-2.5 1.3-.6.6-1.1 1.7-1 2.6 1 .1 1.9-.4 2.6-1.2z"
                fill="#fff"
              />
            </Svg>
            <Text maxFontSizeMultiplier={1.5} style={styles.appleBtnText}>
              {busy ? 'Signing in…' : 'Sign in with Apple'}
            </Text>
          </View>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { marginTop: 0 },
  title: {
    fontFamily: fonts.headingRegular,
    fontSize: 40,
    lineHeight: 44,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    ...noFakeBold,
  },
  body: {
    fontFamily: fonts.bodyLight,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
    marginBottom: spacing.xl,
  },
  savedList: {
    gap: 14,
    marginBottom: spacing.xl,
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  savedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.text,
  },
  savedText: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: '#C0392B',
    marginBottom: spacing.md,
  },
  legal: {
    marginBottom: spacing.md,
  },
  actions: {
    marginTop: 'auto',
    gap: 16,
    paddingBottom: spacing.md,
  },
  appleBtn: {
    width: '100%',
    height: 52,
    borderRadius: 999,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appleBtnDisabled: {
    opacity: 0.55,
  },
  appleBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appleBtnText: {
    color: '#fff',
    fontFamily: fonts.bodyMedium,
    fontSize: 17,
  },
});
