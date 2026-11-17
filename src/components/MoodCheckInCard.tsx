import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useMoodCheckIn } from '../context/MoodCheckInContext';
import { fetchMoodAdvice } from '../services/moodAdvice';
import {
  accents,
  colors,
  fonts,
  noFakeBold,
  radii,
  spacing,
  typeScale,
} from '../theme';
import { InputPill } from './InputPill';
import { LoadingLabel } from './LoadingLabel';

const MAX_CHARS = 160;

/**
 * "How are you feeling today?" as the user's own words. Future You answers
 * right away, and the words shape tomorrow's wake message (they are the
 * mood the next ring is built from).
 */
export function MoodCheckInCard({ name }: { name: string }) {
  const { today, saveCheckIn } = useMoodCheckIn();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  const submit = async () => {
    const words = text.trim().slice(0, MAX_CHARS);
    if (!words || busy) return;
    setBusy(true);
    try {
      const result = await fetchMoodAdvice({ mood: words, note: '', name });
      saveCheckIn({
        moodId: 'own-words',
        moodLabel: words,
        note: '',
        advice: result.text,
      });
      setText('');
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const showAnswer = Boolean(today?.moodLabel) && !editing && !busy;

  return (
    <View style={styles.wrap}>
      <Text maxFontSizeMultiplier={1.2} style={styles.title}>
        How are you feeling today?
      </Text>
      <Text maxFontSizeMultiplier={1.4} style={styles.hint}>
        Your words shape tomorrow’s alarm.
      </Text>

      {showAnswer && today ? (
        <View style={styles.card}>
          <Text maxFontSizeMultiplier={1.4} style={styles.said}>
            “{today.moodLabel}”
          </Text>
          {today.advice ? (
            <Text maxFontSizeMultiplier={1.3} style={styles.reply}>
              {today.advice}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setText(today.moodLabel);
              setEditing(true);
            }}
            hitSlop={8}
            style={styles.changeBtn}
          >
            <Text maxFontSizeMultiplier={1.3} style={styles.change}>
              change
            </Text>
          </Pressable>
        </View>
      ) : busy ? (
        <View style={[styles.card, styles.loadingCard]}>
          <LoadingLabel text="Sitting with that" style={styles.loading} />
        </View>
      ) : (
        <InputPill
          value={text}
          onChangeText={(v) => setText(v.slice(0, MAX_CHARS))}
          onSubmit={() => void submit()}
          placeholder="Tired, but hopeful…"
          autoFocus={editing}
          buttonColor={accents.gold}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.xl },
  title: {
    fontFamily: fonts.headingRegular,
    ...typeScale.title2,
    color: colors.text,
    marginBottom: spacing.xs,
    ...noFakeBold,
  },
  hint: {
    fontFamily: fonts.body,
    ...typeScale.subhead,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.chip,
    borderRadius: radii.card,
    borderCurve: 'continuous',
    padding: spacing.lg,
    gap: spacing.xs,
  },
  loadingCard: { minHeight: 64, justifyContent: 'center' },
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
  changeBtn: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
  change: {
    fontFamily: fonts.bodyMedium,
    ...typeScale.subhead,
    color: colors.text,
    textDecorationLine: 'underline',
    ...noFakeBold,
  },
  loading: {
    fontFamily: fonts.body,
    ...typeScale.subhead,
    color: colors.text,
  },
});
