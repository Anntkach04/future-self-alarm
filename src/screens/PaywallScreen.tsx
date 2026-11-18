import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BackButton } from '../components/BackButton';
import { FeatureList } from '../components/FeatureList';
import { PLAN_BENEFITS } from '../data/planBenefits';
import { PlanPicker, TrialTimeline } from '../components/PlanPicker';
import { Screen } from '../components/Screen';
import { TextArrowButton } from '../components/TextArrowButton';
import { useAlarms } from '../context/AlarmsContext';
import { useOnboarding } from '../context/OnboardingContext';
import { RootStackParamList } from '../navigation/types';
import {
  configurePurchases,
  getPlanOptions,
  hasPurchasesKey,
  planProblem,
  purchasePlan,
  restorePurchases,
  type PlanKind,
  type PlanOptions,
} from '../services/subscriptions';
import { canRemindTrialEnd, scheduleTrialEndReminder } from '../services/trialReminder';
import { userFacingError } from '../services/userFacingError';
import { privacyPolicyUrl, termsOfUseUrl } from '../config/legal';
import { accents, colors, fonts, noFakeBold, spacing, opticalLeft, typeScale } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Paywall'>;

const BENEFITS = PLAN_BENEFITS;

export function PaywallScreen({ navigation, route }: Props) {
  const gated = Boolean(route.params?.gated);
  const { alarms } = useAlarms();
  const { markOnboardingComplete } = useOnboarding();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [options, setOptions] = useState<PlanOptions | null>(null);
  const [selected, setSelected] = useState<PlanKind>('annual');
  const [canRemind, setCanRemind] = useState(false);
  const plan = options?.[selected] ?? null;
  const trial = Boolean(plan?.trialDays);

  const [planLoading, setPlanLoading] = useState(true);
  const terms = termsOfUseUrl();
  const privacy = privacyPolicyUrl();
  const mounted = useRef(true);
  useEffect(() => () => {
    mounted.current = false;
  }, []);

  const loadPlan = async () => {
    setPlanLoading(true);
    await configurePurchases();
    const next = await getPlanOptions();
    const remind = await canRemindTrialEnd();
    if (!mounted.current) return;
    setOptions(next);
    setCanRemind(remind);
    // Yearly first; fall back to whichever plan the store returned.
    setSelected(next?.annual?.priceString ? 'annual' : 'monthly');
    setPlanLoading(false);
  };

  useEffect(() => {
    void loadPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guideline 3.1.2: never offer a purchase without the StoreKit price.
  // Builds without a RevenueCat key (local dev) skip this.
  const priceMissing =
    hasPurchasesKey() && !planLoading && !plan?.priceString;
  const canBuy = !busy && !planLoading && !priceMissing;

  const after = () => {
    if (gated) {
      // Lapsed subscriber renewed — straight back into the app.
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
      return;
    }
    if (alarms.length === 0) {
      navigation.replace('CreateAlarm');
      return;
    }
    markOnboardingComplete();
    navigation.replace('OnboardingCongrats');
  };

  const startTrial = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      // Local / pre-store builds: no RC key yet — let founders finish the flow.
      if (!hasPurchasesKey()) {
        after();
        return;
      }
      await configurePurchases();
      const status = await purchasePlan(selected);
      if (!status.active) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          after();
          return;
        }
        setError(
          'Could not start your subscription. Check your Apple ID payment method, then try again.'
        );
        return;
      }
      if (status.inTrial) void scheduleTrialEndReminder(status.expiresAt);
      after();
    } catch (e) {
      const msg = userFacingError(e, 'Purchase failed');
      if (
        typeof __DEV__ !== 'undefined' &&
        __DEV__ &&
        /not ready|No subscription package|StoreKit|cancelled|canceled/i.test(
          msg
        )
      ) {
        after();
        return;
      }
      if (/cancel/i.test(msg)) {
        setNote('Purchase cancelled. Tap the button below when you are ready.');
        return;
      }
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      if (!hasPurchasesKey()) {
        after();
        return;
      }
      const status = await restorePurchases();
      if (status.active) {
        after();
        return;
      }
      setNote(
        'No subscription on this Apple ID yet. Restore is only for people who already subscribed.'
      );
    } catch (e) {
      setError(userFacingError(e, 'Restore failed'));
    } finally {
      setBusy(false);
    }
  };

  const ctaLabel = trial
    ? plan?.trialDays === 7
      ? 'start free week'
      : 'start free trial'
    : 'continue';

  return (
    <Screen>
      {gated ? null : <BackButton style={styles.back} />}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.title}>
          {gated ? 'Keep waking up\nto future you' : 'Wake up to\nyour own voice'}
        </Text>

        <FeatureList items={BENEFITS} color={accents.mist} />

        <View style={styles.plans}>
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
        </View>

        {trial && plan?.trialDays ? (
          <TrialTimeline
            days={plan.trialDays}
            priceString={plan.priceString}
            reminder={canRemind}
          />
        ) : null}

        {priceMissing ? (
          <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.error}>
            We couldn’t load the price from the App Store. Check your connection
            and try again.
          </Text>
        ) : null}
        {priceMissing && planProblem() ? (
          <Text maxFontSizeMultiplier={1.5} style={styles.diag} selectable>
            {planProblem()}
          </Text>
        ) : null}
        {error ? <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.error}>{error}</Text> : null}
        {note ? <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.note}>{note}</Text> : null}
      </ScrollView>

      <View style={styles.actions}>
        {priceMissing ? (
          <TextArrowButton
            label="try again"
            wide
            color={accents.gold}
            onPress={() => void loadPlan()}
            disabled={busy}
          />
        ) : (
          <TextArrowButton
            wide
            label={busy ? 'one moment' : ctaLabel}
            color={accents.gold}
            onPress={() => void startTrial()}
            disabled={!canBuy}
          />
        )}
        {plan?.disclosure ? (
          <Text maxFontSizeMultiplier={1.4} style={styles.disclosure}>
            {plan.disclosure} Cancel anytime in Settings.
          </Text>
        ) : null}
        {/* Restore + the legal links Apple requires (3.1.2), one quiet row. */}
        <View style={styles.footRow}>
          <Text
            maxFontSizeMultiplier={1.4}
            accessibilityRole="button"
            onPress={busy ? undefined : () => void restore()}
            style={styles.footLink}
          >
            Restore
          </Text>
          {terms ? (
            <>
              <Text maxFontSizeMultiplier={1.4} style={styles.footDot}>·</Text>
              <Text maxFontSizeMultiplier={1.4} accessibilityRole="link" onPress={() => void Linking.openURL(terms)} style={styles.footLink}>
                Terms of Use
              </Text>
            </>
          ) : null}
          {privacy ? (
            <>
              <Text maxFontSizeMultiplier={1.4} style={styles.footDot}>·</Text>
              <Text maxFontSizeMultiplier={1.4} accessibilityRole="link" onPress={() => void Linking.openURL(privacy)} style={styles.footLink}>
                Privacy Policy
              </Text>
            </>
          ) : null}
          {gated ? (
            <>
              <Text maxFontSizeMultiplier={1.4} style={styles.footDot}>·</Text>
              <Text
                maxFontSizeMultiplier={1.4}
                accessibilityRole="button"
                onPress={busy ? undefined : () => navigation.navigate('EditProfile')}
                style={styles.footLink}
              >
                Account
              </Text>
            </>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { marginTop: 0 },
  scroll: { flex: 1, overflow: 'visible' },
  scrollContent: { paddingBottom: spacing.lg, gap: spacing.lg },
  title: {
    fontFamily: fonts.headingRegular,
    ...typeScale.title1,
    ...opticalLeft(40),
    color: colors.text,
    marginTop: spacing.md,
    ...noFakeBold,
  },
  plans: { minHeight: 72, justifyContent: 'center', paddingTop: spacing.xs },
  diag: {
    fontFamily: fonts.body,
    ...typeScale.footnote,
    color: colors.textMuted,
  },
  error: {
    fontFamily: fonts.body,
    ...typeScale.subhead,
    color: accents.danger,
  },
  note: {
    fontFamily: fonts.body,
    ...typeScale.subhead,
    color: colors.textMuted,
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
  footRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    columnGap: spacing.xs,
  },
  footLink: {
    fontFamily: fonts.body,
    ...typeScale.footnote,
    color: colors.textMuted,
    textDecorationLine: 'underline',
    paddingVertical: spacing.xs,
  },
  footDot: {
    fontFamily: fonts.body,
    ...typeScale.footnote,
    color: colors.textMuted,
  },
});
