import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMoodCheckIn } from '../context/MoodCheckInContext';
import { useOnboarding } from '../context/OnboardingContext';
import { dailyMoodExample } from '../data/moodExample';
import { useAlarms, type Alarm } from '../context/AlarmsContext';
import { nextAlarmOccurrences } from '../services/alarmScheduler';
import {
  accents,
  colors,
  fonts,
  noFakeBold,
  radii,
  spacing,
  typeScale,
} from '../theme';
import { ForwardArrow } from './ForwardArrow';
import { MoodWhySheet } from './MoodWhySheet';

const MAX_CHARS = 160;

/**
 * "How are you feeling today?" as the user's own words. Future You answers
 * right away, and the words shape tomorrow's wake message (they are the
 * mood the next ring is built from).
 */
export function MoodCheckInCard({ name }: { name: string }) {
  const { today, previous, saveCheckIn, setOutcome } = useMoodCheckIn();
  const { answers, addFutureSelf } = useOnboarding();
  const { alarms } = useAlarms();
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  // The old bottom sheet answers: `words` = just sent, `reopen` = saved one.
  const [sheet, setSheet] = useState<{ words: string; reopen: boolean } | null>(null);

  // A short example in their own terms; changes every day.
  const example = useMemo(
    () =>
      dailyMoodExample({
        futureSelf: answers.futureSelf,
        hardMornings: answers.hardMornings,
        morningFeelings: answers.morningFeelings,
      }),
    [answers.futureSelf, answers.hardMornings, answers.morningFeelings]
  );

  const nextRingLabel = useMemo(() => nextRingText(alarms), [alarms]);

  // Last check-in's plan, asked about once: did it happen?
  const followUp =
    previous?.intention && !previous.outcome && isYesterday(previous.date)
      ? previous
      : null;

  const submit = () => {
    const words = text.trim().slice(0, MAX_CHARS);
    if (!words) return;
    setSheet({ words, reopen: false });
    setText('');
    setEditing(false);
  };

  const showAnswer = Boolean(today?.moodLabel) && !editing;

  return (
    <View style={styles.wrap}>
      <Text maxFontSizeMultiplier={1.2} style={styles.title}>
        How are you feeling today?
      </Text>
      <Text maxFontSizeMultiplier={1.3} style={styles.hint}>
        Your words shape tomorrow’s alarm.
      </Text>

      {followUp ? (
        <View style={styles.followUp}>
          <Text maxFontSizeMultiplier={1.4} style={styles.followUpText}>
            Yesterday you wanted to {followUp.intention}. Did you?
          </Text>
          <View style={styles.followUpRow}>
            {(
              [
                ['yes', 'yes'],
                ['partly', 'partly'],
                ['no', 'not yet'],
              ] as const
            ).map(([value, label]) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                onPress={() => setOutcome(followUp.date, value)}
                style={({ pressed }) => [styles.followUpChip, pressed && styles.pressed]}
              >
                <Text maxFontSizeMultiplier={1.3} style={styles.followUpChipText}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {showAnswer && today ? (
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Shows Future You’s reply"
          onPress={() => setSheet({ words: today.moodLabel, reopen: true })}
          style={styles.card}
        >
          <Text maxFontSizeMultiplier={1.4} style={styles.said}>
            “{today.moodLabel}”
          </Text>
          {today.intention ? (
            <Text maxFontSizeMultiplier={1.4} style={styles.tomorrow}>
              {nextRingLabel ?? 'Next alarm:'} I’ll remind you to {today.intention}.
            </Text>
          ) : null}
          <View style={styles.links}>
            <Text maxFontSizeMultiplier={1.3} style={styles.change}>
              see reply
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setText(today.moodLabel);
                setEditing(true);
              }}
              hitSlop={8}
            >
              <Text maxFontSizeMultiplier={1.3} style={styles.change}>
                change
              </Text>
            </Pressable>
          </View>
        </Pressable>
      ) : (
        // Same underline field as every onboarding question.
        <View style={styles.field}>
          {/* The example sits one step below the subtitle, so it reads as a
              hint, not as text. A real placeholder can't be sized apart from
              what they type, hence the overlay. */}
          {text ? null : (
            <View pointerEvents="none" style={styles.exampleWrap}>
              <Text maxFontSizeMultiplier={1.2} numberOfLines={2} style={styles.example}>
                {example}
              </Text>
            </View>
          )}
          <TextInput
            maxFontSizeMultiplier={1.3}
            value={text}
            onChangeText={(v) => setText(v.slice(0, MAX_CHARS))}
            onSubmitEditing={submit}
            accessibilityLabel="How are you feeling today?"
            accessibilityHint={example}
            multiline
            submitBehavior="submit"
            returnKeyType="send"
            autoFocus={editing}
            selectionColor={colors.text}
            underlineColorAndroid="transparent"
            style={styles.input}
          />
          {text.trim() ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send"
              onPress={submit}
              hitSlop={12}
              style={styles.send}
            >
              <ForwardArrow size={18} color={colors.text} />
            </Pressable>
          ) : null}
        </View>
      )}

      <MoodWhySheet
        visible={Boolean(sheet)}
        mood={null}
        freeText={sheet?.words ?? null}
        saved={
          sheet?.reopen && today
            ? { advice: today.advice, intention: today.intention }
            : null
        }
        name={name}
        goals={answers.futureSelf}
        feelings={answers.morningFeelings}
        nextRingLabel={nextRingLabel}
        onAddGoal={addFutureSelf}
        onClose={() => setSheet(null)}
        onSaved={({ mood, advice, intention }) =>
          saveCheckIn({
            moodId: 'own-words',
            moodLabel: mood.label,
            note: '',
            advice,
            intention,
          })
        }
      />
    </View>
  );
}

function isYesterday(dateKey: string) {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return dateKey === key;
}

/** "Tomorrow at 7:00" / "Today at 9:30" for the next enabled alarm, or null. */
function nextRingText(alarms: Alarm[]) {
  const next = alarms
    .filter((a) => a.enabled)
    .map((a) => nextAlarmOccurrences(a, 1)[0])
    .filter((d): d is Date => Boolean(d))
    .sort((a, b) => a.getTime() - b.getTime())[0];
  if (!next) return null;
  const now = new Date();
  const time = `${next.getHours()}:${String(next.getMinutes()).padStart(2, '0')}`;
  const sameDay = next.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (sameDay) return `Today at ${time}`;
  if (next.toDateString() === tomorrow.toDateString()) return `Tomorrow at ${time}`;
  return `On ${next.toLocaleDateString('en-US', { weekday: 'long' })} at ${time}`;
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.xl },
  title: {
    fontFamily: fonts.headingRegular,
    ...typeScale.title3,
    color: colors.text,
    ...noFakeBold,
  },
  hint: {
    fontFamily: fonts.body,
    ...typeScale.subhead,
    color: colors.textMuted,
    marginTop: spacing.xxs,
    marginBottom: spacing.xs,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.text,
    minHeight: 48,
  },
  exampleWrap: {
    position: 'absolute',
    left: 0,
    right: 48,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  example: {
    fontFamily: fonts.body,
    ...typeScale.footnote,
    color: colors.placeholder,
  },
  input: {
    flex: 1,
    fontFamily: fonts.body,
    // Small type so a fuller, personal example fits.
    ...typeScale.subhead,
    color: colors.text,
    paddingVertical: spacing.xs,
    paddingHorizontal: 0,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: accents.lime,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxs,
  },
  card: {
    backgroundColor: colors.chip,
    borderRadius: radii.card,
    borderCurve: 'continuous',
    padding: spacing.lg,
    gap: spacing.xs,
  },
  said: {
    fontFamily: fonts.body,
    ...typeScale.subhead,
    color: colors.textMuted,
  },
  reply: {
    fontFamily: fonts.headingRegular,
    ...typeScale.title3,
    color: colors.text,
    ...noFakeBold,
  },
  links: { flexDirection: 'row', gap: spacing.md, minHeight: 32, alignItems: 'center' },
  tomorrow: {
    fontFamily: fonts.body,
    ...typeScale.subhead,
    color: colors.text,
  },
  followUp: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  followUpText: {
    fontFamily: fonts.body,
    ...typeScale.subhead,
    color: colors.text,
  },
  followUpRow: { flexDirection: 'row', gap: spacing.xs },
  followUpChip: {
    borderWidth: 1,
    borderColor: colors.text,
    borderRadius: radii.chip,
    paddingHorizontal: spacing.sm,
    minHeight: 36,
    justifyContent: 'center',
  },
  followUpChipText: {
    fontFamily: fonts.body,
    ...typeScale.subhead,
    color: colors.text,
  },
  pressed: { opacity: 0.7 },
  change: {
    fontFamily: fonts.bodyMedium,
    ...typeScale.subhead,
    color: colors.text,
    textDecorationLine: 'underline',
    ...noFakeBold,
  },
});
