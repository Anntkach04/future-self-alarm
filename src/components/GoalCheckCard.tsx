import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useOnboarding } from '../context/OnboardingContext';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, noFakeBold, radii, spacing, typeScale, chipMetrics } from '../theme';

/** Ask about each goal again after this long. */
const RECHECK_DAYS = 14;
/** A goal we see for the first time gets its first check this soon. */
const FIRST_CHECK_DAYS = 3;
const DAY_MS = 86_400_000;

/**
 * Goals change. Every couple of weeks Home asks about one of them:
 * still on it, done (celebrated in the next morning's message), or change it.
 */
export function GoalCheckCard() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { answers, checkGoal, seedGoalChecks } = useOnboarding();
  const [doneGoal, setDoneGoal] = useState<string | null>(null);
  const goals = answers.futureSelf;
  const checks = answers.goalChecks ?? {};

  // Start the clock for goals we have no date for yet.
  useEffect(() => {
    const missing = goals.filter((g) => !checks[g]);
    if (!missing.length) return;
    const start = new Date(
      Date.now() - (RECHECK_DAYS - FIRST_CHECK_DAYS) * DAY_MS
    ).toISOString();
    seedGoalChecks(Object.fromEntries(missing.map((g) => [g, start])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals.join('|')]);

  const due = useMemo(() => {
    const now = Date.now();
    return (
      goals
        .filter((g) => checks[g] && now - Date.parse(checks[g]) >= RECHECK_DAYS * DAY_MS)
        .sort((a, b) => Date.parse(checks[a]) - Date.parse(checks[b]))[0] ?? null
    );
  }, [goals, checks]);

  if (doneGoal) {
    return (
      <View style={styles.card}>
        <Text maxFontSizeMultiplier={1.2} style={styles.title}>
          You did it.
        </Text>
        <Text maxFontSizeMultiplier={1.4} style={styles.body}>
          “{doneGoal}” is done. Tomorrow morning I’ll tell you how proud I am. What’s next for you?
        </Text>
        <View style={styles.row}>
          <Chip
            label="add a new goal"
            onPress={() => {
              setDoneGoal(null);
              navigation.navigate('ProfileFieldEdit', { field: 'futureSelf' });
            }}
          />
          <Chip label="later" onPress={() => setDoneGoal(null)} />
        </View>
      </View>
    );
  }

  if (!due) return null;

  return (
    <View style={styles.card}>
      <Text maxFontSizeMultiplier={1.2} style={styles.title}>
        Still working on this?
      </Text>
      <Text maxFontSizeMultiplier={1.4} style={styles.body}>
        “{due}”. Goals change, and that’s good. Your mornings follow what matters now.
      </Text>
      <View style={styles.row}>
        <Chip label="still on it" onPress={() => checkGoal(due, 'keep')} />
        <Chip
          label="done 🎉"
          onPress={() => {
            checkGoal(due, 'done');
            setDoneGoal(due);
          }}
        />
        <Chip
          label="change"
          onPress={() => {
            checkGoal(due, 'keep');
            navigation.navigate('ProfileFieldEdit', { field: 'futureSelf' });
          }}
        />
      </View>
    </View>
  );
}

function Chip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
    >
      <Text maxFontSizeMultiplier={1.3} style={styles.chipText}>
        {label}
      </Text>
    </Pressable>
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
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.text,
    borderRadius: radii.chip,
    // Same size as onboarding chips.
    paddingHorizontal: chipMetrics.paddingHorizontal,
    paddingVertical: chipMetrics.paddingVertical,
    justifyContent: 'center',
  },
  chipText: {
    fontFamily: fonts.body,
    fontSize: chipMetrics.fontSize,
    lineHeight: chipMetrics.lineHeight,
    color: colors.text,
  },
  pressed: { opacity: 0.7 },
});
