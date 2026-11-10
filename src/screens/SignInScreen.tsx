import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import * as AppleAuthenticationUI from 'expo-apple-authentication';
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { BackButton } from '../components/BackButton';
import { FeatureList, type FeatureItem } from '../components/FeatureList';
import { privacyPolicyUrl, termsOfUseUrl } from '../config/legal';
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
import { accents, colors, fonts, noFakeBold, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'SignIn'>;

const COPY = {
  save: {
    title: 'Keep your\nfuture voice',
    body: 'Save what you just made to your Apple ID. It stays with you on any iPhone.',
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

const SAVED_ITEMS: FeatureItem[] = [
  { icon: 'voice', title: 'Your cloned voice', body: 'Ready for every alarm, on any iPhone.' },
  { icon: 'alarm', title: 'Your alarms', body: 'Times, days and wake-up messages.' },
  { icon: 'heart', title: 'Your answers', body: 'So every morning stays personal.' },
];

const PRIVATE_ITEM: FeatureItem = {
  icon: 'lock',
  title: 'Private by design',
  body: 'No password. We never sell your data.',
};

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

  const terms = termsOfUseUrl();
  const privacy = privacyPolicyUrl();
  const items = mode === 'resume' ? [SAVED_ITEMS[0], PRIVATE_ITEM] : [...SAVED_ITEMS];

  return (
    <Screen>
      <BackButton style={styles.back} />
      <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.title}>{copy.title}</Text>
      <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.body}>{copy.body}</Text>

      <FeatureList items={items} color={accents.mist} />

      <View style={styles.actions}>
        {error ? <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.error}>{error}</Text> : null}
        <View style={styles.appleWrap} pointerEvents={busy ? 'none' : 'auto'}>
          <AppleAuthenticationUI.AppleAuthenticationButton
            buttonType={
              mode === 'save'
                ? AppleAuthenticationUI.AppleAuthenticationButtonType.CONTINUE
                : AppleAuthenticationUI.AppleAuthenticationButtonType.SIGN_IN
            }
            buttonStyle={AppleAuthenticationUI.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={26}
            style={[styles.appleBtn, busy && styles.appleBtnBusy]}
            onPress={() => void signInWithApple()}
          />
          {busy ? (
            <View style={styles.appleSpinner} pointerEvents="none">
              <ActivityIndicator color="#fff" />
            </View>
          ) : null}
        </View>
        {terms || privacy ? (
          <Text maxFontSizeMultiplier={1.5} style={styles.legal}>
            By continuing, you agree to our{' '}
            {terms ? (
              <Text accessibilityRole="link" style={styles.legalLink} onPress={() => void Linking.openURL(terms)}>
                Terms of Use
              </Text>
            ) : null}
            {terms && privacy ? ' and ' : ''}
            {privacy ? (
              <Text accessibilityRole="link" style={styles.legalLink} onPress={() => void Linking.openURL(privacy)}>
                Privacy Policy
              </Text>
            ) : null}
            .
          </Text>
        ) : null}
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
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: '#C0392B',
    textAlign: 'center',
  },
  actions: {
    marginTop: 'auto',
    gap: 14,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  appleWrap: {
    width: '100%',
    height: 52,
  },
  appleBtn: {
    width: '100%',
    height: 52,
  },
  appleBtnBusy: {
    opacity: 0.6,
  },
  appleSpinner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legal: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  legalLink: {
    textDecorationLine: 'underline',
  },
});
