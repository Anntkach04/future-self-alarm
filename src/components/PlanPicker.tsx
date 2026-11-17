import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PlanDetails, PlanKind, PlanOptions } from '../services/subscriptions';
import { accents, colors, fonts, noFakeBold, radii, spacing, typeScale } from '../theme';

type Props = {
  options: PlanOptions;
  selected: PlanKind;
  onSelect: (kind: PlanKind) => void;
  disabled?: boolean;
};

/**
 * Two plan cards, yearly first and preselected. Prices always come from
 * StoreKit (localized); the savings badge only shows when it's computable.
 */
export function PlanPicker({ options, selected, onSelect, disabled }: Props) {
  const rows: { plan: PlanDetails; title: string; price: string; sub: string | null }[] = [];
  if (options.annual?.priceString) {
    const a = options.annual;
    rows.push({
      plan: a,
      title: 'Yearly',
      price: a.perMonthString ? `${a.perMonthString}/mo` : `${a.priceString}/yr`,
      sub: a.perMonthString ? `${a.priceString} billed yearly` : null,
    });
  }
  if (options.monthly?.priceString) {
    const m = options.monthly;
    rows.push({ plan: m, title: 'Monthly', price: `${m.priceString}/mo`, sub: 'Billed monthly' });
  }

  return (
    <View style={styles.list} accessibilityRole="radiogroup">
      {rows.map(({ plan, title, price, sub }) => {
        const active = plan.kind === selected;
        const badge =
          plan.kind === 'annual' && options.annualSavingsPercent
            ? `Save ${options.annualSavingsPercent}%`
            : null;
        return (
          <Pressable
            key={plan.kind}
            accessibilityRole="radio"
            accessibilityState={{ selected: active, disabled }}
            accessibilityLabel={`${title}, ${price}${sub ? `, ${sub}` : ''}${
              plan.trialDays ? `, ${plan.trialDays} days free` : ''
            }`}
            disabled={disabled}
            onPress={() => onSelect(plan.kind)}
            style={({ pressed }) => [
              styles.card,
              active && styles.cardActive,
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.radio, active && styles.radioActive]}>
              {active ? <View style={styles.radioDot} /> : null}
            </View>
            <View style={styles.texts}>
              <View style={styles.titleRow}>
                <Text maxFontSizeMultiplier={1.3} style={styles.title}>
                  {title}
                </Text>
                {plan.trialDays ? (
                  <Text maxFontSizeMultiplier={1.3} style={styles.trial}>
                    {plan.trialDays} days free
                  </Text>
                ) : null}
              </View>
              {sub ? (
                <Text maxFontSizeMultiplier={1.3} style={styles.sub}>
                  {sub}
                </Text>
              ) : null}
            </View>
            <Text maxFontSizeMultiplier={1.3} style={styles.price}>
              {price}
            </Text>
            {badge ? (
              <View style={styles.badge}>
                <Text maxFontSizeMultiplier={1.2} style={styles.badgeText}>
                  {badge}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** What happens during the free week — removes the fear of a surprise charge. */
export function TrialTimeline({
  days,
  priceString,
  reminder,
}: {
  days: number;
  priceString: string | null;
  /** Only promise a reminder when we can actually send one. */
  reminder: boolean;
}) {
  const remindDay = Math.max(1, days - 2);
  const steps = [
    { when: 'Today', what: 'Full access. Your voice wakes you tomorrow.' },
    ...(reminder
      ? [{ when: `Day ${remindDay}`, what: 'We remind you the trial is ending.' }]
      : []),
    {
      when: `Day ${days}`,
      what: priceString
        ? `${priceString} is charged. Cancel before to pay nothing.`
        : 'Your plan starts. Cancel before to pay nothing.',
    },
  ];
  return (
    <View style={styles.timeline}>
      {steps.map((s, i) => (
        <View key={s.when} style={styles.step}>
          <View style={styles.rail}>
            <View style={[styles.dot, i === 0 && styles.dotNow]} />
            {i < steps.length - 1 ? <View style={styles.line} /> : null}
          </View>
          <View style={styles.stepText}>
            <Text maxFontSizeMultiplier={1.3} style={styles.when}>
              {s.when}
            </Text>
            <Text maxFontSizeMultiplier={1.4} style={styles.what}>
              {s.what}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.xs },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 72,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.card,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(26, 26, 26, 0.16)',
    backgroundColor: colors.inputBg,
  },
  cardActive: {
    borderWidth: 2,
    borderColor: colors.text,
    backgroundColor: '#FFF4D6',
  },
  pressed: { transform: [{ scale: 0.98 }] },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: colors.text, backgroundColor: colors.text },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.bg },
  texts: { flex: 1, gap: spacing.xxs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  title: {
    fontFamily: fonts.bodyMedium,
    ...typeScale.body,
    color: colors.text,
    ...noFakeBold,
  },
  trial: {
    fontFamily: fonts.body,
    ...typeScale.footnote,
    color: colors.textMuted,
  },
  sub: {
    fontFamily: fonts.body,
    ...typeScale.footnote,
    color: colors.textMuted,
  },
  price: {
    fontFamily: fonts.bodyMedium,
    ...typeScale.body,
    color: colors.text,
    ...noFakeBold,
  },
  badge: {
    position: 'absolute',
    top: -12,
    right: spacing.md,
    backgroundColor: accents.ink,
    borderRadius: radii.chip,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  badgeText: {
    fontFamily: fonts.bodyMedium,
    ...typeScale.footnote,
    color: colors.bg,
    ...noFakeBold,
  },
  timeline: { gap: 0 },
  step: { flexDirection: 'row', gap: spacing.md },
  rail: { width: 16, alignItems: 'center' },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.bg,
    marginTop: spacing.xxs,
  },
  dotNow: { backgroundColor: accents.gold },
  line: { flex: 1, width: 1, backgroundColor: colors.border, marginVertical: spacing.xxs },
  stepText: { flex: 1, paddingBottom: spacing.md, gap: spacing.xxs },
  when: {
    fontFamily: fonts.bodyMedium,
    ...typeScale.subhead,
    color: colors.text,
    ...noFakeBold,
  },
  what: {
    fontFamily: fonts.body,
    ...typeScale.subhead,
    color: colors.textMuted,
  },
});
