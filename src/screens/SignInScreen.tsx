import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BackButton } from '../components/BackButton';
import { LegalLinks } from '../components/LegalLinks';
import { Screen } from '../components/Screen';
import { TextArrowButton } from '../components/TextArrowButton';
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
import { FOUNDER_AUTH_SKIP_ENABLED } from '../config/devBypass';
import { userFacingError } from '../services/userFacingError';
import { accents, colors, fonts, noFakeBold, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'SignIn'>;

/** Dev Metro OR founder Release skip — turn FOUNDER_AUTH_SKIP_ENABLED off for Store. */
const allowDevSignInBypass =
  FOUNDER_AUTH_SKIP_ENABLED ||
  (typeof __DEV__ !== 'undefined' && __DEV__);

export function SignInScreen({ navigation }: Props) {
  const {
    appleUserId,
    setAppleAccount,
    voiceLevel,
    bedLevel,
    setMixLevels,
    setSessionReauth,
  } = useAppSettings();
  const {
    answers,
    voice,
    onboardingComplete,
    hydrateFromCloud,
  } = useOnboarding();
  const { today, hydrateMood } = useMoodCheckIn();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const goNext = () => {
    navigation.replace('NotificationPermission');
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
        return Boolean(cloud.onboardingComplete || cloud.voiceId || bundle.user.voiceId);
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
    } catch (error) {
      console.warn('Cloud profile sync failed', error);
      return false;
    }
  };

  const registerOnServer = async (input: {
    identityToken: string;
    userId: string;
    email?: string | null;
    authorizationCode?: string | null;
  }) => {
    // Fail-closed for store: server auth must succeed (no silent local-only account).
    await signInWithAppleOnServer({
      identityToken: input.identityToken,
      email: input.email ?? null,
      authorizationCode: input.authorizationCode ?? null,
    });
    await syncCloudAfterSignIn();
    setAppleAccount(input.userId, input.email ?? null);
    setSessionReauth(false);
    await configurePurchases(input.userId);
  };

  const signInWithApple = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);

    if (Platform.OS !== 'ios') {
      if (!allowDevSignInBypass) {
        setError('Sign in with Apple is available on iPhone.');
        setBusy(false);
        return;
      }
      const id = `dev_${Date.now()}`;
      await registerOnServer({
        identityToken: `dev.${id}`,
        userId: id,
      });
      setBusy(false);
      goNext();
      return;
    }

    try {
      const AppleAuthentication = await import('expo-apple-authentication');
      const available = await AppleAuthentication.isAvailableAsync();
      if (!available) {
        if (!allowDevSignInBypass) {
          setError(
            'Sign in with Apple is not available on this device. Update iOS and try again.'
          );
          return;
        }
        const id = `dev_${Date.now()}`;
        await registerOnServer({
          identityToken: `dev.${id}`,
          userId: id,
        });
        goNext();
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
      await registerOnServer({
        identityToken: cred.identityToken,
        userId: cred.user,
        email: cred.email ?? null,
        authorizationCode: cred.authorizationCode ?? null,
      });
      goNext();
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'ERR_REQUEST_CANCELED') return;
      console.warn('Apple Sign In failed', err);
      if (allowDevSignInBypass) {
        const id = `local_${Date.now()}`;
        await registerOnServer({
          identityToken: `dev.${id}`,
          userId: id,
        });
        goNext();
        return;
      }
      setError(
        userFacingError(
          err,
          'Could not sign in with Apple. Check Settings → Apple ID, then try again.'
        )
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <BackButton style={styles.back} />
      <Text style={styles.title}>Save your{'\n'}Future Self</Text>
      <Text style={styles.body}>
        Sign in with Apple so your voice and alarms stay with you, private,
        on your terms.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <LegalLinks style={styles.legal} />

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => void signInWithApple()}
          style={[styles.appleBtn, busy && styles.appleBtnDisabled]}
          disabled={busy}
        >
          <Text style={styles.appleBtnText}> Sign in with Apple</Text>
        </Pressable>
        {appleUserId ? (
          <TextArrowButton
            label="continue"
            color={colors.fab}
            onPress={goNext}
            disabled={busy}
          />
        ) : (
          <TextArrowButton
            label="continue"
            color={accents.gold}
            onPress={() => void signInWithApple()}
            disabled={busy}
          />
        )}
        {FOUNDER_AUTH_SKIP_ENABLED ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              const id = `skip_${Date.now()}`;
              void (async () => {
                await registerOnServer({
                  identityToken: `dev.${id}`,
                  userId: id,
                });
                goNext();
              })();
            }}
            style={styles.skipBtn}
          >
            <Text style={styles.skipText}>skip sign in (dev) →</Text>
          </Pressable>
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
    fontFamily: fonts.bodyLight,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
    marginBottom: spacing.xl,
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
  appleBtnText: {
    color: '#fff',
    fontFamily: fonts.bodyMedium,
    fontSize: 17,
  },
  skipBtn: {
    alignSelf: 'center',
    paddingVertical: 10,
  },
  skipText: {
    fontFamily: fonts.bodyLight,
    fontSize: 14,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
});
