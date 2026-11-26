import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useOnboarding, type WakeStruggle } from '../context/OnboardingContext';
import { colors, fonts, noFakeBold, radii, spacing, typeScale } from '../theme';

const OPTIONS: { value: WakeStruggle; label: string }[] = [
  { value: 'asleep', label: 'I turn it off and fall back asleep' },
  { value: 'snooze', label: 'I snooze again and again' },
  { value: 'phone', label: 'I grab my phone and scroll' },
  { value: 'low', label: 'I get up, but feel low' },
  { value: 'fine', label: 'Mornings are fine' },
];

/**
 * One question, asked once on Home: what goes wrong after the alarm.
 * The answer shapes the wake message, the "are you up?" check and the
 * screen after "I'm up".
 */
export function WakeStruggleCard() {
  const { answers, onboardingComplete, setWakeStruggle } = useOnboarding();
  if (!onboardingComplete || answers.wakeStruggle) return null;

  return (
    <View style={styles.card}>
      <Text maxFontSizeMultiplier={1.2} style={styles.title}>
        One question, so I can wake you better
      </Text>
      <Text maxFontSizeMultiplier={1.4} style={styles.body}>
        What usually happens after your alarm?
      </Text>
      <View style={styles.options}>
        {OPTIONS.map((o) => (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            onPress={() => setWakeStruggle(o.value)}
            style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
          >
            <Text maxFontSizeMultiplier={1.3} style={styles.chipText}>
              {o.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.chip,
    borderRadius: radii.card,
    borderCurve: 'continuous',
    padding: spacing.lg,
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  title: {
    fontFamily: fonts.headingRegular,
    ...typeScale.title3,
    color: colors.text,
    ...noFakeBold,
  },
  body: {
    fontFamily: fonts.body,
    ...typeScale.subhead,
    color: colors.textMuted,
  },
  options: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.text,
    borderRadius: radii.chip,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipText: {
    fontFamily: fonts.body,
    ...typeScale.subhead,
    color: colors.text,
  },
  pressed: { opacity: 0.7 },
});
