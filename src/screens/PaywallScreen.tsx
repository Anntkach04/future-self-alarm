import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BackButton } from '../components/BackButton';
import { FeatureList, type FeatureItem } from '../components/FeatureList';
import { Screen } from '../components/Screen';
import { TextArrowButton } from '../components/TextArrowButton';
import { useAlarms } from '../context/AlarmsContext';
import { useOnboarding } from '../context/OnboardingContext';
import { RootStackParamList } from '../navigation/types';
import {
  configurePurchases,
  getMonthlyPlanDetails,
  hasPurchasesKey,
  planProblem,
  restorePurchases,
  startMonthlyWithTrial,
  type MonthlyPlanDetails,
} from '../services/subscriptions';
import { userFacingError } from '../services/userFacingError';
import { privacyPolicyUrl, termsOfUseUrl } from '../config/legal';
import { accents, colors, fonts, noFakeBold, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Paywall'>;

const BENEFITS: FeatureItem[] = [
  { icon: 'voice', title: 'Your own voice', body: 'Wake up to future you, every morning.' },
  { icon: 'heart', title: 'Written for you', body: 'A new message from your goals and habits.' },
  { icon: 'alarm', title: 'Shaped by your mood', body: 'Today’s check-in changes tomorrow’s alarm.' },
];

export function PaywallScreen({ navigation, route }: Props) {
  const gated = Boolean(route.params?.gated);
  const { alarms } = useAlarms();
  const { markOnboardingComplete } = useOnboarding();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [plan, setPlan] = useState<MonthlyPlanDetails | null>(null);
  const trial = Boolean(plan?.trialDays);
  const trialLabel =
    plan?.trialDays === 7
      ? 'a week'
      : `${plan?.trialDays ?? 0} days`;

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
    const next = await getMonthlyPlanDetails();
    if (!mounted.current) return;
    setPlan(next);
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
      const status = await startMonthlyWithTrial();
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

  return (
    <Screen>
      {gated ? null : <BackButton style={styles.back} />}
      <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.title}>
        {gated
          ? 'Keep waking up\nto future you'
          : trial
            ? `Try future self\nfree for ${trialLabel}`
            : 'Wake up to\nfuture you'}
      </Text>
      <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.body}>
        {trial
          ? `${plan?.trialDays === 7 ? 'One week' : `${plan?.trialDays} days`} free, then monthly`
          : 'Monthly'}{' '}
        through Apple.
        Cancel anytime.
      </Text>

      <FeatureList items={BENEFITS} color={accents.mist} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={trial ? 'Start free trial, monthly plan' : 'Subscribe, monthly plan'}
        onPress={() => void startTrial()}
        disabled={!canBuy}
        style={({ pressed }) => [
          styles.planCard,
          pressed && styles.planCardPressed,
          busy && styles.planCardBusy,
        ]}
      >
        <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.planName}>Monthly</Text>
        <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.planPrice}>
          {planLoading
            ? 'Loading price…'
            : priceMissing
              ? 'Price unavailable'
              : (plan?.headline ?? '')}
        </Text>
        {plan?.disclosure ? (
          <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.disclosure}>{plan.disclosure}</Text>
        ) : null}
      </Pressable>

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
      {busy ? (
        <ActivityIndicator color={colors.text} style={{ marginTop: 12 }} />
      ) : null}

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
            label={trial ? 'start free trial' : 'subscribe'}
            color={accents.gold}
            onPress={() => void startTrial()}
            disabled={!canBuy}
          />
        )}
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
        </View>
        {gated ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Manage account"
            onPress={() => navigation.navigate('EditProfile')}
            disabled={busy}
            style={styles.restoreLink}
          >
            <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.restoreText}>Manage account</Text>
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
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  diag: {
    marginTop: 6,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  planCard: {
    marginTop: 12,
    borderRadius: 24,
    padding: 18,
    gap: 8,
    backgroundColor: accents.gold,
  },
  planCardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  planCardBusy: {
    opacity: 0.7,
  },
  planName: {
    fontFamily: fonts.headingRegular,
    fontSize: 28,
    lineHeight: 34,
    color: colors.text,
    ...noFakeBold,
  },
  planPrice: {
    fontFamily: fonts.body,
    fontSize: 17,
    lineHeight: 24,
    color: colors.text,
  },
  disclosure: {
    marginTop: 8,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
    opacity: 0.8,
  },
  error: {
    marginTop: 12,
    fontFamily: fonts.body,
    fontSize: 14,
    color: '#C0392B',
  },
  note: {
    marginTop: 12,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  actions: {
    marginTop: 'auto',
    gap: 18,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    alignItems: 'stretch',
  },
  footRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    columnGap: 8,
  },
  footLink: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    textDecorationLine: 'underline',
    paddingVertical: 6,
  },
  footDot: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
  },
  restoreLink: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  restoreText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    opacity: 0.8,
    textDecorationLine: 'underline',
  },
});
