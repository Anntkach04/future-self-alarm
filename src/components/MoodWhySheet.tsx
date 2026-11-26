import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { type Mood } from '../data/moods';
import { fetchMoodAdvice } from '../services/moodAdvice';
import { accents, colors, fonts, noFakeBold, radii, spacing, opticalLeft } from '../theme';
import { LoadingLabel } from './LoadingLabel';
import { LogoSpinner } from './LogoSpinner';
import { TextArrowButton } from './TextArrowButton';

type Phase = 'compose' | 'loading' | 'advice';

type Saved = {
  mood: Mood;
  note: string;
  advice: string;
  intention: string | null;
  newGoal: string | null;
};

type Props = {
  mood: Mood | null;
  name: string;
  visible: boolean;
  onClose: () => void;
  onSaved: (payload: Saved) => void;
  /**
   * Home's free-text check-in: the words are already written, so the sheet
   * opens straight on "Sitting with that" and then Future You's reply.
   */
  freeText?: string | null;
  /** Goals + wished-for morning feelings, so the reply is personal. */
  goals?: string[];
  feelings?: string[];
  /** "Tomorrow at 7:00" — when the next alarm rings, if there is one. */
  nextRingLabel?: string | null;
  /** Adds a goal they mentioned; the sheet offers it under the reply. */
  onAddGoal?: (goal: string) => void;
  /** Re-opening a saved check-in: show this reply, don't ask again. */
  saved?: { advice: string; intention?: string | null } | null;
};

/** Free text has no mood tile: show the words, in a calm accent. */
const FREE_TEXT_COLOR = accents.gold;

export function MoodWhySheet({
  mood: moodProp,
  name,
  visible,
  onClose,
  onSaved,
  freeText,
  goals,
  feelings,
  nextRingLabel,
  onAddGoal,
  saved,
}: Props) {
  const mood: Mood | null = freeText
    ? ({ id: 'own-words', label: freeText, color: FREE_TEXT_COLOR } as Mood)
    : moodProp;
  const [note, setNote] = useState('');
  const [phase, setPhase] = useState<Phase>('compose');
  const [advice, setAdvice] = useState('');
  const [fromAi, setFromAi] = useState(true);
  const [intention, setIntention] = useState<string | null>(null);
  const [newGoal, setNewGoal] = useState<string | null>(null);
  const [goalAdded, setGoalAdded] = useState(false);

  useEffect(() => {
    if (visible) {
      setNote('');
      setPhase(freeText ? 'loading' : 'compose');
      setAdvice('');
      setFromAi(true);
      setIntention(null);
      setNewGoal(null);
      setGoalAdded(false);
      if (freeText && saved) {
        setAdvice(saved.advice);
        setIntention(saved.intention ?? null);
        setPhase('advice');
      } else if (freeText) {
        void submit();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, mood?.id, freeText]);

  const submit = async () => {
    if (!mood) return;
    setPhase('loading');
    const result = await fetchMoodAdvice({
      mood: mood.label,
      note: note.trim(),
      name,
      goals,
      feelings,
    });
    setAdvice(result.text);
    setFromAi(result.fromAi);
    setIntention(result.intention ?? null);
    setNewGoal(result.newGoal ?? null);
    setPhase('advice');
    onSaved({
      mood,
      note: note.trim(),
      advice: result.text,
      intention: result.intention ?? null,
      newGoal: result.newGoal ?? null,
    });
  };

  // What tomorrow's alarm will do with this, so they know it counts.
  const tomorrowLine = nextRingLabel
    ? intention
      ? `${nextRingLabel} I’ll remind you to ${intention}.`
      : `${nextRingLabel} I’ll wake you with this in mind.`
    : 'Turn on an alarm and I’ll wake you with this in mind.';

  return (
    <Modal
      visible={visible && Boolean(mood)}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />
            {mood ? (
              <Text
                maxFontSizeMultiplier={1.2}
                lineBreakStrategyIOS="push-out"
                numberOfLines={freeText ? 3 : undefined}
                style={[styles.moodName, mood.label.length > 22 && styles.moodNameLong]}
              >
                {mood.label}
              </Text>
            ) : null}

            {phase === 'compose' ? (
              <>
                <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.question}>Why do you feel that way?</Text>
                <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.moodPurpose}>
                  Future you will use this for tomorrow’s alarm only. After one
                  wake, it resets.
                </Text>
                <TextInput maxFontSizeMultiplier={1.5}
                  value={note}
                  onChangeText={setNote}
                  placeholder="A few words, if you want"
                  placeholderTextColor={colors.placeholder}
                  multiline
                  autoFocus
                  style={styles.input}
                  selectionColor={colors.text}
                  underlineColorAndroid="transparent"
                />
                <View style={styles.actions}>
                  <TextArrowButton
                    label="shape tomorrow"
                    color={mood?.color ?? accents.gold}
                    onPress={() => void submit()}
                  />
                </View>
              </>
            ) : null}

            {phase === 'loading' ? (
              <View style={styles.center}>
                <LogoSpinner size={40} />
                <LoadingLabel text="Sitting with that" style={styles.loading} />
              </View>
            ) : null}

            {phase === 'advice' ? (
              <>
                <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.advice}>{advice}</Text>
                <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.moodPurpose}>
                  {tomorrowLine}
                </Text>
                {newGoal && onAddGoal ? (
                  <View style={styles.goalRow}>
                    <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.goalText}>
                      {goalAdded
                        ? `Added to your goals: ${newGoal}.`
                        : `Sounds like a new goal: ${newGoal}. Add it to your goals?`}
                    </Text>
                    {goalAdded ? null : (
                      <Pressable
                        accessibilityRole="button"
                        hitSlop={8}
                        onPress={() => {
                          onAddGoal(newGoal);
                          setGoalAdded(true);
                        }}
                      >
                        <Text maxFontSizeMultiplier={1.4} style={styles.goalLink}>
                          add goal
                        </Text>
                      </Pressable>
                    )}
                  </View>
                ) : null}
                <View style={styles.actions}>
                  <TextArrowButton
                    label="thank you"
                    color={mood?.color ?? accents.gold}
                    onPress={onClose}
                  />
                </View>
              </>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(26, 26, 26, 0.28)',
  },
  sheetWrap: {
    width: '100%',
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.inset,
    paddingTop: 16,
    paddingBottom: 40,
    minHeight: 280,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 24,
  },
  moodName: {
    fontFamily: fonts.headingRegular,
    fontSize: 40,
    ...opticalLeft(40),
    lineHeight: 44,
    color: colors.text,
    marginBottom: 8,
    ...noFakeBold,
  },
  /** Their own words can be a sentence: same serif, a step smaller. */
  moodNameLong: {
    fontSize: 28,
    lineHeight: 32,
    marginLeft: 0,
  },
  question: {
    fontFamily: fonts.headingRegular,
    fontSize: 22,
    lineHeight: 28,
    color: colors.text,
    marginBottom: 8,
    ...noFakeBold,
  },
  moodPurpose: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textMuted,
    marginBottom: 16,
  },
  input: {
    minHeight: 88,
    fontFamily: fonts.body,
    fontSize: 17,
    lineHeight: 24,
    color: colors.text,
    padding: 0,
    marginBottom: 24,
    ...noFakeBold,
    ...(Platform.OS === 'web'
      ? ({
          outlineStyle: 'none',
          outlineWidth: 0,
        } as object)
      : null),
  },
  actions: {
    alignItems: 'flex-end',
  },
  center: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 16,
  },
  loading: {
    fontFamily: fonts.headingRegular,
    fontSize: 22,
    color: colors.text,
    ...noFakeBold,
  },
  advice: {
    fontFamily: fonts.headingRegular,
    fontSize: 22,
    lineHeight: 28,
    color: colors.text,
    marginBottom: 24,
    ...noFakeBold,
  },
  goalRow: {
    gap: 8,
    marginBottom: 24,
  },
  goalText: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
  },
  goalLink: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
    textDecorationLine: 'underline',
    ...noFakeBold,
  },
  offline: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 16,
    color: colors.textMuted,
    marginTop: -16,
    marginBottom: 24,
  },
});
