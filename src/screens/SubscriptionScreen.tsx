import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BackButton } from '../components/BackButton';
import { LegalLinks } from '../components/LegalLinks';
import { LoadingLabel } from '../components/LoadingLabel';
import { PlanPicker, TrialTimeline } from '../components/PlanPicker';
import { Screen } from '../components/Screen';
import { TextArrowButton } from '../components/TextArrowButton';
import { RootStackParamList } from '../navigation/types';
import {
  ANNUAL_PRODUCT_ID,
  getPlanOptions,
  getSubscriptionStatus,
  hasPurchasesKey,
  openManageSubscriptions,
  purchasePlan,
  restorePurchases,
  type PlanKind,
  type PlanOptions,
  type SubStatus,
} from '../services/subscriptions';
import { canRemindTrialEnd, scheduleTrialEndReminder } from '../services/trialReminder';
import {
  accents,
  colors,
  fonts,
  noFakeBold,
  opticalLeft,
  radii,
  spacing,
  typeScale,
} from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Subscription'>;

function formatDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

export function SubscriptionScreen({}: Props) {
  const [status, setStatus] = useState<SubStatus | null>(null);
  const [options, setOptions] = useState<PlanOptions | null>(null);
  const [selected, setSelected] = useState<PlanKind>('annual');
  const [canRemind, setCanRemind] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const plan = options?.[selected] ?? null;

  const loadPlan = async () => {
    setPlanLoading(true);
    const next = await getPlanOptions();
    setOptions(next);
    setSelected(next?.annual?.priceString ? 'annual' : 'monthly');
    setCanRemind(await canRemindTrialEnd());
    setPlanLoading(false);
  };

  useEffect(() => {
    void getSubscriptionStatus().then(setStatus);
    void loadPlan();
  }, []);

  // Guideline 3.1.2: no purchase button without the StoreKit price.
  const priceMissing = hasPurchasesKey() && !planLoading && !plan?.priceString;

  const run = async (fn: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  const start = () =>
    run(async () => {
      const next = await purchasePlan(selected);
      setStatus(next);
      if (next.inTrial) void scheduleTrialEndReminder(next.expiresAt);
    }, 'Purchase failed');
  const restore = () =>
    run(async () => setStatus(await restorePurchases()), 'Restore failed');
  const manage = () =>
    run(() => openManageSubscriptions(), 'Could not open Apple subscriptions');

  const active = Boolean(status?.active);
  const planName =
    status?.productId === ANNUAL_PRODUCT_ID ? 'Yearly plan' : 'Monthly plan';
  const until = formatDate(status?.expiresAt ?? null);

  return (
    <Screen>
      <BackButton style={styles.back} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text maxFontSizeMultiplier={1.2} style={styles.title}>
          Subscription
        </Text>

        {!status ? (
          <LoadingLabel text="Checking" style={styles.meta} />
        ) : active ? (
          <View style={styles.card}>
            <Text maxFontSizeMultiplier={1.2} style={styles.status}>
              {status.inTrial ? 'Free trial' : planName}
            </Text>
            {until ? (
              <Text maxFontSizeMultiplier={1.4} style={styles.meta}>
                {status.inTrial ? `Trial ends ${until}` : `Renews ${until}`}
              </Text>
            ) : null}
          </View>
        ) : (
          <>
            <Text maxFontSizeMultiplier={1.4} style={styles.body}>
              Your own voice every morning, with a new message shaped by
              your mood.
            </Text>
            {planLoading ? (
              <ActivityIndicator color={colors.text} />
            ) : options && (options.annual?.priceString || options.monthly?.priceString) ? (
              <PlanPicker
                options={options}
                selected={selected}
                onSelect={setSelected}
                disabled={busy}
              />
            ) : null}
            {plan?.trialDays ? (
              <TrialTimeline
                days={plan.trialDays}
                priceString={plan.priceString}
                reminder={canRemind}
              />
            ) : null}
          </>
        )}

        {!hasPurchasesKey() ? (
          <Text maxFontSizeMultiplier={1.4} style={styles.meta}>
            {__DEV__
              ? 'Dev unlock (no RevenueCat appl_ key yet)'
              : 'Subscriptions are unavailable right now.'}
          </Text>
        ) : null}
        {error ? (
          <Text maxFontSizeMultiplier={1.4} style={styles.error}>
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.actions}>
        <TextArrowButton
          wide
          label={
            active
              ? 'manage in apple'
              : priceMissing
                ? 'try again'
                : plan?.trialDays === 7
                  ? 'start free week'
                  : plan?.trialDays
                    ? 'start free trial'
                    : 'continue'
          }
          color={accents.gold}
          onPress={() => void (active ? manage() : priceMissing ? loadPlan() : start())}
          disabled={busy || (!active && planLoading)}
        />
        {!active && plan?.disclosure ? (
          <Text maxFontSizeMultiplier={1.4} style={styles.disclosure}>
            {plan.disclosure} Cancel anytime in Settings.
          </Text>
        ) : null}
        <View style={styles.footRow}>
          <Text
            maxFontSizeMultiplier={1.4}
            accessibilityRole="button"
            onPress={busy ? undefined : () => void restore()}
            style={styles.footLink}
          >
            Restore purchases
          </Text>
        </View>
        <LegalLinks />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { marginTop: 0 },
  scroll: { flex: 1, overflow: 'visible' },
  scrollContent: { gap: spacing.lg, paddingBottom: spacing.lg },
  title: {
    fontFamily: fonts.headingRegular,
    ...typeScale.title1,
    ...opticalLeft(40),
    color: colors.text,
    marginTop: spacing.xs,
    ...noFakeBold,
  },
  body: {
    fontFamily: fonts.body,
    ...typeScale.body,
    color: colors.text,
  },
  card: {
    borderRadius: radii.card,
    borderCurve: 'continuous',
    padding: spacing.lg,
    gap: spacing.xs,
    backgroundColor: colors.chip,
  },
  status: {
    fontFamily: fonts.headingRegular,
    ...typeScale.title2,
    color: colors.text,
    ...noFakeBold,
  },
  meta: {
    fontFamily: fonts.body,
    ...typeScale.subhead,
    color: colors.textMuted,
  },
  error: {
    fontFamily: fonts.body,
    ...typeScale.subhead,
    color: accents.danger,
  },
  actions: {
    gap: spacing.xs,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    alignItems: 'stretch',
  },
  disclosure: {
    fontFamily: fonts.body,
    ...typeScale.footnote,
    color: colors.textMuted,
    textAlign: 'center',
  },
  footRow: { alignItems: 'center' },
  footLink: {
    fontFamily: fonts.body,
    ...typeScale.footnote,
    color: colors.textMuted,
    textDecorationLine: 'underline',
    paddingVertical: spacing.xs,
  },
});
