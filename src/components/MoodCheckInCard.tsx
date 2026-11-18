import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMoodCheckIn } from '../context/MoodCheckInContext';
import { fetchMoodAdvice } from '../services/moodAdvice';
import {
  colors,
  fonts,
  noFakeBold,
  radii,
  spacing,
  typeScale,
} from '../theme';
import { ForwardArrow } from './ForwardArrow';
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
        // Same underline field as every onboarding question.
        <View style={styles.field}>
          <TextInput
            maxFontSizeMultiplier={1.5}
            value={text}
            onChangeText={(v) => setText(v.slice(0, MAX_CHARS))}
            onSubmitEditing={() => void submit()}
            placeholder="Tired, but hopeful…"
            placeholderTextColor={colors.placeholder}
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
              onPress={() => void submit()}
              hitSlop={12}
              style={styles.send}
            >
              <ForwardArrow color={colors.text} />
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
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
  input: {
    flex: 1,
    fontFamily: fonts.body,
    ...typeScale.body,
    color: colors.text,
    paddingVertical: spacing.xs,
    paddingHorizontal: 0,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  send: { paddingVertical: spacing.xs },
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
