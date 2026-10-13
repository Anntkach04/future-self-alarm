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
  getSubscriptionStatus,
  hasPurchasesKey,
  openManageSubscriptions,
  restorePurchases,
  startMonthlyWithTrial,
  type SubStatus,
} from '../services/subscriptions';
import { accents, colors, fonts, noFakeBold, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Subscription'>;

export function SubscriptionScreen({}: Props) {
  const [status, setStatus] = useState<SubStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getSubscriptionStatus().then(setStatus);
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
      setError(e instanceof Error ? e.message : 'Could not open Apple subscriptions');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <BackButton style={styles.back} />
      <Text style={styles.title}>Subscription</Text>
      <Text style={styles.body}>
        7 days free, then monthly. Managed by Apple. Cancel anytime in Settings
        → Apple ID → Subscriptions.
      </Text>
      <LegalLinks style={styles.legal} />

      <View style={styles.block}>
        {!status ? (
          <LoadingLabel text="Checking" style={styles.status} />
        ) : (
          <Text style={styles.status}>
            {status.active
              ? status.inTrial
                ? 'Trial active'
                : 'Member'
              : 'Not subscribed'}
          </Text>
        )}
        {status?.expiresAt ? (
          <Text style={styles.meta}>Renews / ends {status.expiresAt}</Text>
        ) : null}
        {!hasPurchasesKey() ? (
          <Text style={styles.meta}>Dev unlock (no RevenueCat key yet)</Text>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {busy ? <ActivityIndicator color={colors.text} /> : null}

      <View style={styles.actions}>
        <TextArrowButton
          label={status?.active ? 'manage in apple' : 'start free week'}
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
    color: colors.text,
    marginBottom: spacing.sm,
    ...noFakeBold,
  },
  body: {
    fontFamily: fonts.bodyLight,
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
    fontSize: 26,
    color: colors.text,
    ...noFakeBold,
  },
  meta: {
    fontFamily: fonts.bodyLight,
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
