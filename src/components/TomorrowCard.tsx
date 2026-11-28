import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useAlarms } from '../context/AlarmsContext';
import { useMoodCheckIn } from '../context/MoodCheckInContext';
import { nextAlarmOccurrences } from '../services/alarmScheduler';
import { moodKeyOf, PREPARE_WINDOW_HOURS } from '../services/eveningRegen';
import { moodForAlarm } from '../services/moodForAlarm';
import { ringMessageAt, type RingMessage } from '../services/ringBank';
import { instantOn, timeLabel, upcomingZoneDays } from '../services/timeZone';
import { colors, fonts, mutedPalette, noFakeBold, radii, spacing, typeScale } from '../theme';
import { LoadingLabel } from './LoadingLabel';

const POLL_MS = 4000;
const POLL_FOR_MS = 4 * 60 * 1000;

function firstSentence(text: string) {
  const clean = text.trim();
  const match = clean.match(/^.+?[.!?](\s|$)/);
  return (match ? match[0] : clean).trim();
}

/**
 * After an evening check-in: "Tomorrow at 7:00 future you will say…" with the
 * first line of the message built from it, and a play button. Shows the
 * person their words really reached tomorrow's alarm.
 */
export function TomorrowCard() {
  const { alarms } = useAlarms();
  const { today, previous } = useMoodCheckIn();
  const [message, setMessage] = useState<RingMessage | null>(null);
  const [playing, setPlaying] = useState(false);
  const playerRef = useRef<AudioPlayer | null>(null);

  // The next ring, if it is close enough to be built from tonight's words.
  const next = useMemo(() => {
    const now = Date.now();
    return (
      alarms
        .filter((a) => a.enabled)
        .map((a) => ({ alarmId: a.id, at: nextAlarmOccurrences(a, 1)[0]?.getTime() }))
        .filter((r): r is { alarmId: string; at: number } => Boolean(r.at))
        .filter((r) => r.at - now <= PREPARE_WINDOW_HOURS * 3_600_000)
        .sort((a, b) => a.at - b.at)[0] ?? null
    );
  }, [alarms]);

  const wantKey = useMemo(() => moodKeyOf(moodForAlarm(today, previous)), [today, previous]);

  useEffect(() => {
    setMessage(null);
    if (!today || !next) return;
    let alive = true;
    const started = Date.now();
    const check = async () => {
      const m = await ringMessageAt(next.alarmId, next.at);
      if (!alive) return;
      // Ready once the ring was rebuilt with tonight's check-in.
      if (m && m.prepKey.startsWith(`${wantKey}|`)) {
        setMessage(m);
        return;
      }
      if (Date.now() - started < POLL_FOR_MS) timer = setTimeout(() => void check(), POLL_MS);
    };
    let timer: ReturnType<typeof setTimeout> | null = null;
    void check();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [today, next, wantKey]);

  useEffect(
    () => () => {
      playerRef.current?.remove();
      playerRef.current = null;
    },
    []
  );

  if (!today || !next) return null;

  const days = upcomingZoneDays(2);
  const tomorrow = days[1] && next.at >= instantOn(days[1], 0, 0);
  const when = `${tomorrow ? 'Tomorrow' : 'Today'} at ${timeLabel(next.at)}`;

  const toggle = async () => {
    if (!message) return;
    if (playing) {
      playerRef.current?.pause();
      playerRef.current?.remove();
      playerRef.current = null;
      setPlaying(false);
      return;
    }
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
    const uri = /^(file:|https?:)/.test(message.mp3Uri) ? message.mp3Uri : `file://${message.mp3Uri}`;
    const player = createAudioPlayer({ uri });
    playerRef.current = player;
    player.addListener('playbackStatusUpdate', (s) => {
      if (s.didJustFinish) {
        setPlaying(false);
        player.remove();
        if (playerRef.current === player) playerRef.current = null;
      }
    });
    setPlaying(true);
    player.play();
  };

  return (
    <View style={styles.card}>
      <Text maxFontSizeMultiplier={1.3} style={styles.kicker}>
        {when}, future you will say
      </Text>
      {message ? (
        <>
          <Text maxFontSizeMultiplier={1.2} style={styles.line}>
            “{firstSentence(message.text)}”
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={playing ? 'Stop' : 'Listen to tomorrow’s message'}
            onPress={() => void toggle()}
            style={({ pressed }) => [styles.play, pressed && styles.pressed]}
          >
            <Svg width={14} height={14} viewBox="0 0 20 20">
              {playing ? (
                <>
                  <Rect x={4} y={3} width={4} height={14} rx={1} fill={colors.bg} />
                  <Rect x={12} y={3} width={4} height={14} rx={1} fill={colors.bg} />
                </>
              ) : (
                <Path
                  d="M6 3.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L7.5 2.64A1 1 0 0 0 6 3.5Z"
                  fill={colors.bg}
                />
              )}
            </Svg>
            <Text maxFontSizeMultiplier={1.3} style={styles.playText}>
              {playing ? 'stop' : 'hear it now'}
            </Text>
          </Pressable>
        </>
      ) : (
        <LoadingLabel text="Writing tomorrow’s message" style={styles.loading} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: mutedPalette[1],
    borderRadius: radii.card,
    borderCurve: 'continuous',
    padding: spacing.lg,
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  kicker: {
    fontFamily: fonts.body,
    ...typeScale.subhead,
    color: colors.text,
  },
  line: {
    fontFamily: fonts.headingRegular,
    ...typeScale.title3,
    color: colors.text,
    ...noFakeBold,
  },
  play: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.text,
    borderRadius: radii.chip,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    marginTop: spacing.xs,
  },
  playText: {
    fontFamily: fonts.body,
    ...typeScale.subhead,
    color: colors.bg,
  },
  pressed: { opacity: 0.8 },
  loading: {
    fontFamily: fonts.headingRegular,
    ...typeScale.title3,
    color: colors.text,
    ...noFakeBold,
  },
});
