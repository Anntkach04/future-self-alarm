import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BackButton } from '../components/BackButton';
import { LegalLinks } from '../components/LegalLinks';
import { Screen } from '../components/Screen';
import { TextArrowButton } from '../components/TextArrowButton';
import { useAlarms } from '../context/AlarmsContext';
import { useOnboarding } from '../context/OnboardingContext';
import { RootStackParamList } from '../navigation/types';
import {
  configurePurchases,
  getMonthlyPlanDetails,
  hasPurchasesKey,
  restorePurchases,
  startMonthlyWithTrial,
  type MonthlyPlanDetails,
} from '../services/subscriptions';
import { userFacingError } from '../services/userFacingError';
import { accents, colors, fonts, noFakeBold, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Paywall'>;

const BENEFITS = [
  'Wake to your own cloned voice',
  'Personalized morning scripts',
  'Mood check-in shapes tomorrow',
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await configurePurchases();
      const next = await getMonthlyPlanDetails();
      if (!cancelled) setPlan(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
        setNote('Purchase cancelled — tap the button below when you are ready.');
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
      <Text maxFontSizeMultiplier={1.2} style={styles.title}>
        {gated
          ? 'Keep waking up\nto future you'
          : trial
            ? `Try future self\nfree for ${trialLabel}`
            : 'Wake up to\nfuture you'}
      </Text>
      <Text maxFontSizeMultiplier={1.5} style={styles.body}>
        {trial
          ? `${plan?.trialDays === 7 ? 'One week' : `${plan?.trialDays} days`} free, then monthly`
          : 'Monthly'}{' '}
        through your
        Apple ID. Cancel anytime in
        Settings → Apple ID → Subscriptions.
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={trial ? 'Start free trial, monthly plan' : 'Subscribe, monthly plan'}
        onPress={() => void startTrial()}
        disabled={busy}
        style={({ pressed }) => [
          styles.planCard,
          pressed && styles.planCardPressed,
          busy && styles.planCardBusy,
        ]}
      >
        <Text maxFontSizeMultiplier={1.5} style={styles.planBadge}>Most people start here</Text>
        <Text maxFontSizeMultiplier={1.2} style={styles.planName}>Monthly</Text>
        <Text maxFontSizeMultiplier={1.5} style={styles.planPrice}>
          {plan?.headline ?? 'Monthly'}
        </Text>
        <View style={styles.benefits}>
          {BENEFITS.map((line) => (
            <Text maxFontSizeMultiplier={1.5} key={line} style={styles.benefit}>
              · {line}
            </Text>
          ))}
        </View>
        {plan?.disclosure ? (
          <Text maxFontSizeMultiplier={1.5} style={styles.disclosure}>{plan.disclosure}</Text>
        ) : null}
      </Pressable>

      <LegalLinks style={styles.legal} />

      {error ? <Text maxFontSizeMultiplier={1.5} style={styles.error}>{error}</Text> : null}
      {note ? <Text maxFontSizeMultiplier={1.5} style={styles.note}>{note}</Text> : null}
      {busy ? (
        <ActivityIndicator color={colors.text} style={{ marginTop: 12 }} />
      ) : null}

      <View style={styles.actions}>
        <TextArrowButton
          label={trial ? 'start free trial' : 'subscribe'}
          color={accents.gold}
          onPress={() => void startTrial()}
          disabled={busy}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Restore purchases"
          onPress={() => void restore()}
          disabled={busy}
          style={styles.restoreLink}
        >
          <Text maxFontSizeMultiplier={1.5} style={styles.restoreText}>Already subscribed? Restore</Text>
        </Pressable>
        {gated ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Manage account"
            onPress={() => navigation.navigate('EditProfile')}
            disabled={busy}
            style={styles.restoreLink}
          >
            <Text maxFontSizeMultiplier={1.5} style={styles.restoreText}>Manage account</Text>
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
  },
  planCard: {
    marginTop: 20,
    borderWidth: 1.5,
    borderColor: colors.text,
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
  planBadge: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.text,
    opacity: 0.75,
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
  benefits: {
    marginTop: 6,
    gap: 4,
  },
  benefit: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
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
  legal: {
    marginTop: 16,
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
    gap: 14,
    paddingBottom: spacing.md,
    alignItems: 'stretch',
  },
  restoreLink: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  restoreText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    opacity: 0.55,
    textDecorationLine: 'underline',
  },
});
