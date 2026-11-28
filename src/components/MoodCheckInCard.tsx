import { useEffect, useMemo, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMoodCheckIn } from '../context/MoodCheckInContext';
import { useOnboarding } from '../context/OnboardingContext';
import { dailyMoodExample } from '../data/moodExample';
import { useAlarms, type Alarm } from '../context/AlarmsContext';
import { nextAlarmOccurrences } from '../services/alarmScheduler';
import { instantOn, timeLabel, upcomingZoneDays, wallClock } from '../services/timeZone';
import {
  accents,
  colors,
  fonts,
  noFakeBold,
  radii,
  spacing,
  typeScale, chipMetrics } from '../theme';
import { ForwardArrow } from './ForwardArrow';
import { MicIcon } from './MicRecordButton';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { onCheckIn } from '../services/checkInBridge';
import { transcribeVoiceNote } from '../services/elevenlabs';
import { userFacingError } from '../services/userFacingError';
import { MoodWhySheet } from './MoodWhySheet';

const MAX_CHARS = 160;
/** A voice note to tomorrow-you: short, so the whole alarm fits in 28 s. */
const NOTE_MAX_MS = 10_000;

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
  // Voice note to tomorrow-you: recorded here, plays first in the next alarm.
  const recorder = useVoiceRecorder();
  const [note, setNote] = useState<{ uri: string; text: string } | null>(null);
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const recording = recorder.status === 'recording';

  // A reply typed into the evening notification arrives here.
  useEffect(() => onCheckIn((words) => setSheet({ words, reopen: false })), []);

  const finishNote = async () => {
    const tmp = await recorder.stop();
    if (!tmp) return;
    setNoteBusy(true);
    setNoteError(null);
    try {
      // Keep it past cache clean-ups: it has to survive until the morning.
      const dir = `${FileSystem.documentDirectory}voice-notes/`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
      const uri = `${dir}${Date.now()}.m4a`;
      await FileSystem.copyAsync({ from: tmp, to: uri });
      const words = await transcribeVoiceNote(uri);
      if (!words) {
        setNoteError('I couldn’t hear that. Try again a little closer, or type it.');
        return;
      }
      setNote({ uri, text: words });
      setSheet({ words, reopen: false });
    } catch (e) {
      setNoteError(userFacingError(e, 'Couldn’t save your voice note. Try again.'));
    } finally {
      setNoteBusy(false);
    }
  };

  // Stop by itself at 10 s.
  useEffect(() => {
    if (recording && recorder.durationMs >= NOTE_MAX_MS) void finishNote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, recorder.durationMs]);

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
          {today.voiceNoteUri ? (
            <Text maxFontSizeMultiplier={1.4} style={styles.tomorrow}>
              Your voice note plays first in your next alarm.
            </Text>
          ) : null}
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
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={recording ? 'Finish voice note' : 'Record a voice note for tomorrow'}
              onPress={() => void (recording ? finishNote() : recorder.start())}
              disabled={noteBusy}
              hitSlop={12}
              style={[styles.send, styles.mic, recording && styles.micOn]}
            >
              <MicIcon color={colors.text} size={20} />
            </Pressable>
          )}
        </View>
      )}
      {recording || noteBusy || noteError || recorder.error ? (
        <Text maxFontSizeMultiplier={1.3} style={[styles.noteStatus, (noteError || recorder.error) && styles.noteError]}>
          {recording
            ? `Recording for tomorrow-you · ${Math.ceil((NOTE_MAX_MS - recorder.durationMs) / 1000)} s left · tap to finish`
            : noteBusy
              ? 'Listening…'
              : noteError || 'Allow the microphone in Settings to record a voice note.'}
        </Text>
      ) : null}

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
        onSaved={({ mood, advice, intention }) => {
          // A note only counts for the check-in it was recorded for.
          const voice = note && note.text === mood.label ? note : null;
          saveCheckIn({
            moodId: 'own-words',
            moodLabel: mood.label,
            note: '',
            advice,
            intention,
            voiceNoteUri: voice?.uri ?? null,
            voiceNoteText: voice?.text ?? null,
          });
          setNote(null);
        }}
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
  // Phone's current zone (timeZone.ts), not the JS engine's launch-time zone.
  const days = upcomingZoneDays(2);
  const ms = next.getTime();
  const time = timeLabel(ms);
  const inDay = (i: number) =>
    days[i] && ms >= instantOn(days[i], 0, 0) && ms < instantOn(days[i], 0, 0) + 86_400_000;
  if (inDay(0)) return `Today at ${time}`;
  if (inDay(1)) return `Tomorrow at ${time}`;
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return `On ${WEEKDAYS[wallClock(ms).weekday]} at ${time}`;
}

const styles = StyleSheet.create({
  mic: {
    backgroundColor: colors.chip,
  },
  micOn: {
    backgroundColor: accents.coral,
  },
  noteStatus: {
    fontFamily: fonts.body,
    ...typeScale.footnote,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  noteError: {
    color: accents.danger,
  },
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
    // Same size as onboarding chips.
    paddingHorizontal: chipMetrics.paddingHorizontal,
    paddingVertical: chipMetrics.paddingVertical,
    justifyContent: 'center',
  },
  followUpChipText: {
    fontFamily: fonts.body,
    fontSize: chipMetrics.fontSize,
    lineHeight: chipMetrics.lineHeight,
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
