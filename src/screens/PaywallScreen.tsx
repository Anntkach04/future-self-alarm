import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { BackButton } from '../components/BackButton';
import { LegalLinks } from '../components/LegalLinks';
import { Screen } from '../components/Screen';
import { TextArrowButton } from '../components/TextArrowButton';
import { useAlarms } from '../context/AlarmsContext';
import { useOnboarding } from '../context/OnboardingContext';
import { RootStackParamList } from '../navigation/types';
import {
  getMonthlyPriceDisclosure,
  hasPurchasesKey,
  restorePurchases,
  startMonthlyWithTrial,
} from '../services/subscriptions';
import { userFacingError } from '../services/userFacingError';
import { accents, colors, fonts, noFakeBold, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Paywall'>;

export function PaywallScreen({ navigation }: Props) {
  const { alarms } = useAlarms();
  const { markOnboardingComplete } = useOnboarding();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** StoreKit localized price — Guideline 3.1.2(c). Null until RC product loads. */
  const [priceDisclosure, setPriceDisclosure] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getMonthlyPriceDisclosure().then((line) => {
      if (!cancelled) setPriceDisclosure(line);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const after = () => {
    if (alarms.length === 0) {
      navigation.replace('CreateAlarm');
      return;
    }
    markOnboardingComplete();
    navigation.replace('Home');
  };

  const startTrial = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // Release builds must not unlock without RevenueCat / StoreKit.
      if (!hasPurchasesKey()) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          after();
          return;
        }
        setError(
          'Subscriptions are not ready yet. Try again after the App Store product is linked.'
        );
        return;
      }
      const status = await startMonthlyWithTrial();
      if (!status.active) {
        setError('Could not start the trial. Try Restore, or try again.');
        return;
      }
      after();
    } catch (e) {
      setError(userFacingError(e, 'Purchase failed'));
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!hasPurchasesKey()) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          after();
          return;
        }
        setError('Subscriptions are not ready yet.');
        return;
      }
      const status = await restorePurchases();
      if (status.active) after();
      else setError('No active subscription found for this Apple ID.');
    } catch (e) {
      setError(userFacingError(e, 'Restore failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <BackButton style={styles.back} />
      <Text style={styles.title}>Try Future Self{'\n'}free for a week</Text>
      <Text style={styles.body}>
        One week free, then a monthly membership billed through your Apple ID.
        Cancel anytime in Settings → Apple ID → Subscriptions. Your cloned
        voice, daily morning regen, and mood → tomorrow wake stay unlocked while
        you are a member.
      </Text>
      {priceDisclosure ? (
        <Text style={styles.priceLine}>{priceDisclosure}</Text>
      ) : null}
      <LegalLinks style={styles.legal} />
      {!hasPurchasesKey() && typeof __DEV__ !== 'undefined' && __DEV__ ? (
        <Text style={styles.devNote}>
          Dev mode: RevenueCat key not set. Continue unlocks locally.
        </Text>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {busy ? <ActivityIndicator color={colors.text} style={{ marginTop: 12 }} /> : null}

      <View style={styles.actions}>
        <TextArrowButton
          label="start free week"
          color={accents.gold}
          onPress={() => void startTrial()}
          disabled={busy}
        />
        <TextArrowButton
          label="restore purchases"
          color={colors.fab}
          onPress={() => void restore()}
          disabled={busy}
        />
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
  },
  priceLine: {
    marginTop: 12,
    fontFamily: fonts.bodyLight,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  legal: {
    marginTop: 16,
  },
  devNote: {
    marginTop: 12,
    fontFamily: fonts.bodyLight,
    fontSize: 13,
    color: colors.textMuted,
  },
  error: {
    marginTop: 12,
    fontFamily: fonts.body,
    fontSize: 14,
    color: '#C0392B',
  },
  actions: {
    marginTop: 'auto',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingBottom: spacing.md,
  },
});
