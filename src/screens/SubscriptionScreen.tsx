import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BackButton } from '../components/BackButton';
import { FeatureList } from '../components/FeatureList';
import { LegalLinks } from '../components/LegalLinks';
import { LoadingLabel } from '../components/LoadingLabel';
import { PlanPicker, TrialTimeline } from '../components/PlanPicker';
import { Screen } from '../components/Screen';
import { TextArrowButton } from '../components/TextArrowButton';
import { PLAN_BENEFITS } from '../data/planBenefits';
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
import { userFacingError } from '../services/userFacingError';
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

/** The UI is English: format dates in English too (not the phone's locale). */
function formatDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function SubscriptionScreen({}: Props) {
  const [status, setStatus] = useState<SubStatus | null>(null);
  const [options, setOptions] = useState<PlanOptions | null>(null);
  const [selected, setSelected] = useState<PlanKind>('annual');
  const [canRemind, setCanRemind] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
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
    setNote(null);
    try {
      await fn();
    } catch (e) {
      const msg = userFacingError(e, fallback);
      if (/cancel/i.test(msg)) setNote('Nothing changed. You can switch any time.');
      else setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const buy = (kind: PlanKind) =>
    run(async () => {
      const next = await purchasePlan(kind);
      setStatus(next);
      if (next.inTrial) void scheduleTrialEndReminder(next.expiresAt);
    }, 'Purchase failed');
  const restore = () =>
    run(async () => {
      const next = await restorePurchases();
      setStatus(next);
      if (!next.active) setNote('No subscription found on this Apple ID.');
    }, 'Restore failed');
  const manage = () =>
    run(() => openManageSubscriptions(), 'Could not open Apple subscriptions');

  const active = Boolean(status?.active);
  const onAnnual = status?.productId === ANNUAL_PRODUCT_ID;
  const current = onAnnual ? options?.annual : options?.monthly;
  const until = formatDate(status?.expiresAt ?? null);
  const priceLine = current?.priceString
    ? `${current.priceString} / ${onAnnual ? 'year' : 'month'}`
    : null;
  // Monthly subscriber + a yearly plan in the store: offer the switch.
  const upsell =
    active && !onAnnual && options?.annual?.priceString ? options.annual : null;

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
          <>
            <View style={styles.card}>
              <Text maxFontSizeMultiplier={1.3} style={styles.eyebrow}>
                Future Self Plus
              </Text>
              <Text maxFontSizeMultiplier={1.2} style={styles.planName}>
                {status.inTrial ? 'Free trial' : onAnnual ? 'Yearly plan' : 'Monthly plan'}
              </Text>
              {priceLine && !status.inTrial ? (
                <Text maxFontSizeMultiplier={1.3} style={styles.price}>
                  {priceLine}
                </Text>
              ) : null}
              {until ? (
                <View style={styles.statusRow}>
                  <View style={styles.statusDot} />
                  <Text maxFontSizeMultiplier={1.4} style={styles.meta}>
                    {status.inTrial
                      ? `Trial ends ${until}${priceLine ? `, then ${priceLine}` : ''}`
                      : `Active · renews ${until}`}
                  </Text>
                </View>
              ) : null}
            </View>

            {upsell ? (
              <View style={styles.upsell}>
                <View style={styles.upsellHead}>
                  <Text maxFontSizeMultiplier={1.2} style={styles.upsellTitle}>
                    Switch to yearly
                  </Text>
                  {options?.annualSavingsPercent ? (
                    <View style={styles.saveBadge}>
                      <Text maxFontSizeMultiplier={1.2} style={styles.saveText}>
                        Save {options.annualSavingsPercent}%
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text maxFontSizeMultiplier={1.4} style={styles.upsellBody}>
                  {upsell.priceString} a year
                  {upsell.perMonthString ? `, just ${upsell.perMonthString} a month` : ''}.
                  Apple switches you when this month ends.
                </Text>
                <TextArrowButton
                  label={busy ? 'one moment' : 'switch to yearly'}
                  color={accents.ink}
                  textColor={colors.bg}
                  onPress={() => void buy('annual')}
                  disabled={busy}
                  style={styles.upsellBtn}
                />
              </View>
            ) : null}

            <Text maxFontSizeMultiplier={1.3} style={styles.section}>
              What’s included
            </Text>
            <FeatureList items={PLAN_BENEFITS} color={colors.chip} />
          </>
        ) : (
          <>
            <Text maxFontSizeMultiplier={1.4} style={styles.body}>
              Your own voice every morning, with a new message shaped by your
              mood.
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
        {note ? (
          <Text maxFontSizeMultiplier={1.4} style={styles.meta}>
            {note}
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.actions}>
        {active ? (
          // Managing is a quiet, secondary action: no big colored button.
          <Pressable
            accessibilityRole="button"
            onPress={() => void manage()}
            disabled={busy}
            style={({ pressed }) => [styles.manage, pressed && styles.pressed]}
          >
            <Text maxFontSizeMultiplier={1.3} style={styles.manageLabel}>
              Manage or cancel in Apple
            </Text>
          </Pressable>
        ) : (
          <>
            <TextArrowButton
              wide
              label={
                priceMissing
                  ? 'try again'
                  : plan?.trialDays === 7
                    ? 'start free week'
                    : plan?.trialDays
                      ? 'start free trial'
                      : 'continue'
              }
              color={accents.gold}
              onPress={() => void (priceMissing ? loadPlan() : buy(selected))}
              disabled={busy || planLoading}
            />
            {plan?.disclosure ? (
              <Text maxFontSizeMultiplier={1.4} style={styles.disclosure}>
                {plan.disclosure} Cancel anytime in Settings.
              </Text>
            ) : null}
          </>
        )}
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
  scrollContent: { gap: spacing.md, paddingBottom: spacing.lg },
  title: {
    fontFamily: fonts.headingRegular,
    ...typeScale.title1,
    ...opticalLeft(40),
    color: colors.text,
    marginBottom: spacing.xs,
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
    gap: spacing.xxs,
    backgroundColor: colors.chip,
  },
  eyebrow: {
    fontFamily: fonts.bodyMedium,
    ...typeScale.footnote,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    ...noFakeBold,
  },
  planName: {
    fontFamily: fonts.headingRegular,
    ...typeScale.title2,
    color: colors.text,
    marginTop: spacing.xxs,
    ...noFakeBold,
  },
  price: {
    fontFamily: fonts.bodyMedium,
    ...typeScale.body,
    color: colors.text,
    ...noFakeBold,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3FA36B',
  },
  meta: {
    fontFamily: fonts.body,
    ...typeScale.subhead,
    color: colors.textMuted,
  },
  upsell: {
    borderRadius: radii.card,
    borderCurve: 'continuous',
    padding: spacing.lg,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.text,
  },
  upsellHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  upsellTitle: {
    fontFamily: fonts.headingRegular,
    ...typeScale.title3,
    color: colors.text,
    flexShrink: 1,
    ...noFakeBold,
  },
  saveBadge: {
    backgroundColor: accents.lime,
    borderRadius: radii.chip,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  saveText: {
    fontFamily: fonts.bodyMedium,
    ...typeScale.footnote,
    color: colors.text,
    ...noFakeBold,
  },
  upsellBody: {
    fontFamily: fonts.body,
    ...typeScale.subhead,
    color: colors.textMuted,
  },
  upsellBtn: { alignSelf: 'flex-start', marginTop: spacing.xs },
  section: {
    fontFamily: fonts.bodyMedium,
    ...typeScale.footnote,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.xs,
    ...noFakeBold,
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
  manage: {
    minHeight: 48,
    borderRadius: radii.chip,
    borderWidth: 1,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  manageLabel: {
    fontFamily: fonts.bodyMedium,
    ...typeScale.body,
    color: colors.text,
    ...noFakeBold,
  },
  pressed: { transform: [{ scale: 0.98 }] },
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
