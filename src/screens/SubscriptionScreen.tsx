import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { BackButton } from '../components/BackButton';
import { LegalLinks } from '../components/LegalLinks';
import { LoadingLabel } from '../components/LoadingLabel';
import { Screen } from '../components/Screen';
import { TextArrowButton } from '../components/TextArrowButton';
import { RootStackParamList } from '../navigation/types';
import {
  getMonthlyPlanDetails,
  getSubscriptionStatus,
  hasPurchasesKey,
  openManageSubscriptions,
  restorePurchases,
  startMonthlyWithTrial,
  type MonthlyPlanDetails,
  type SubStatus,
} from '../services/subscriptions';
import { accents, colors, fonts, noFakeBold, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Subscription'>;

const BENEFITS = [
  'Wake to your own cloned voice',
  'Personalized morning scripts',
  'Mood check-in shapes tomorrow',
];

export function SubscriptionScreen({}: Props) {
  const [status, setStatus] = useState<SubStatus | null>(null);
  const [plan, setPlan] = useState<MonthlyPlanDetails | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getSubscriptionStatus().then(setStatus);
    void getMonthlyPlanDetails().then(setPlan);
  }, []);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      setStatus(await startMonthlyWithTrial());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Purchase failed');
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    setError(null);
    try {
      setStatus(await restorePurchases());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restore failed');
    } finally {
      setBusy(false);
    }
  };

  const manage = async () => {
    setBusy(true);
    setError(null);
    try {
      await openManageSubscriptions();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not open Apple subscriptions'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <BackButton style={styles.back} />
      <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.title}>subscription</Text>
      <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.body}>
        {plan?.trialDays
          ? `${plan.trialDays} days free, then monthly. `
          : 'Billed monthly. '}
        Managed by Apple. Cancel anytime in Settings → Apple ID → Subscriptions.
      </Text>
      <LegalLinks style={styles.legal} />

      <View style={styles.block}>
        {!status ? (
          <LoadingLabel text="Checking" style={styles.status} />
        ) : (
          <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.status}>
            {status.active
              ? status.inTrial
                ? 'Trial active'
                : 'Member'
              : 'Not subscribed'}
          </Text>
        )}
        {status?.expiresAt ? (
          <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.meta}>Renews / ends {status.expiresAt}</Text>
        ) : null}
        {!status?.active ? (
          <>
            <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.planName}>Monthly</Text>
            <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.planPrice}>
              {plan?.headline ?? 'Monthly'}
            </Text>
            {BENEFITS.map((line) => (
              <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" key={line} style={styles.benefit}>
                · {line}
              </Text>
            ))}
          </>
        ) : null}
        {!hasPurchasesKey() ? (
          <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.meta}>
            Dev unlock (no RevenueCat appl_ key yet)
          </Text>
        ) : null}
      </View>

      {error ? <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.error}>{error}</Text> : null}
      {busy ? <ActivityIndicator color={colors.text} /> : null}

      <View style={styles.actions}>
        <TextArrowButton
          label={
            status?.active
              ? 'manage in apple'
              : plan?.trialDays
                ? 'start free trial'
                : 'subscribe'
          }
          color={accents.gold}
          onPress={() => void (status?.active ? manage() : start())}
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
    marginBottom: spacing.sm,
    ...noFakeBold,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  legal: {
    marginBottom: spacing.lg,
  },
  block: {
    borderWidth: 1.5,
    borderColor: colors.text,
    borderRadius: 24,
    padding: 18,
    gap: 6,
    marginBottom: spacing.md,
  },
  status: {
    fontFamily: fonts.headingRegular,
    fontSize: 28,
    lineHeight: 34,
    color: colors.text,
    ...noFakeBold,
  },
  planName: {
    marginTop: 8,
    fontFamily: fonts.headingRegular,
    fontSize: 22,
    color: colors.text,
    ...noFakeBold,
  },
  planPrice: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  benefit: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  meta: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
  },
  error: {
    color: '#C0392B',
    marginBottom: 8,
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
