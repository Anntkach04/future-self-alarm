import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { BackButton } from '../components/BackButton';
import { cleanScript } from '../components/KaraokeScript';
import { Screen } from '../components/Screen';
import { useOnboarding } from '../context/OnboardingContext';
import { RootStackParamList } from '../navigation/types';
import { ensureGuestSession } from '../services/apiAuth';
import { savePreviewAudio } from '../services/audioPreview';
import { buildPreviewLine, synthesizeSpeech } from '../services/elevenlabs';
import { userFacingError } from '../services/userFacingError';
import {
  accents,
  colors,
  fonts,
  noFakeBold,
  opticalLeft,
  radii,
  spacing,
  typeScale,
} from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'VoiceSettings'>;

const BAR_COUNT = 32;
/** Fixed, voice-like bar profile (not random per render). */
const BARS = Array.from({ length: BAR_COUNT }, (_, i) => {
  const v = 0.35 + 0.65 * Math.abs(Math.sin(i * 0.9) * Math.cos(i * 0.37));
  return Math.round(8 + v * 24);
});

function playableUri(uri: string) {
  if (/^(file:|https?:|blob:)/.test(uri)) return uri;
  return `file://${uri}`;
}

function formatSeconds(total: number) {
  const s = Math.max(0, Math.round(total));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

async function fileExists(uri: string | null) {
  if (!uri) return false;
  try {
    return (await FileSystem.getInfoAsync(uri)).exists;
  } catch {
    return false;
  }
}

/** Listen to your cloned voice; re-record from here. No message text. */
export function VoiceSettingsScreen({ navigation }: Props) {
  const { answers, voice, setPreview } = useOnboarding();
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const playerRef = useRef<AudioPlayer | null>(null);
  const subRef = useRef<{ remove: () => void } | null>(null);

  const detach = () => {
    subRef.current?.remove();
    subRef.current = null;
    playerRef.current?.remove();
    playerRef.current = null;
  };
  useEffect(() => () => detach(), []);

  /** Reuse the saved sample; make one only if it's gone. */
  const ensureAudio = async () => {
    if (await fileExists(voice.previewUri)) return voice.previewUri as string;
    if (!voice.voiceId) return null;
    const line = cleanScript(
      voice.previewText ||
        buildPreviewLine(answers.name)
    );
    await ensureGuestSession();
    const tts = await synthesizeSpeech({ voiceId: voice.voiceId, text: line });
    const path = await savePreviewAudio(tts.base64);
    setPreview(path, line);
    return path;
  };

  const stop = () => {
    playerRef.current?.pause();
    detach();
    setPlaying(false);
    setCurrentTime(0);
  };

  const play = async () => {
    if (busy) return;
    if (playing) {
      stop();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      const uri = await ensureAudio();
      if (!uri) {
        setError('Record your voice first to hear it here.');
        return;
      }
      detach();
      const player = createAudioPlayer({ uri: playableUri(uri) }, { updateInterval: 100 });
      playerRef.current = player;
      subRef.current = player.addListener('playbackStatusUpdate', (status) => {
        setCurrentTime(Number(status.currentTime) || 0);
        if (status.duration > 0) setDuration(Number(status.duration));
        if (status.didJustFinish) {
          setPlaying(false);
          setCurrentTime(0);
        }
      });
      setPlaying(true);
      player.play();
    } catch (e) {
      setPlaying(false);
      setError(userFacingError(e, 'Could not play your voice'));
    } finally {
      setBusy(false);
    }
  };

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const status = busy
    ? 'Loading…'
    : playing
      ? `${formatSeconds(currentTime)} / ${formatSeconds(duration)}`
      : duration > 0
        ? formatSeconds(duration)
        : 'Tap to listen';

  return (
    <Screen>
      <BackButton style={styles.back} />
      <Text maxFontSizeMultiplier={1.2} style={styles.title}>
        Voice
      </Text>

      <View style={styles.card}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Stop your voice' : 'Play your voice'}
          onPress={() => void play()}
          style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}
        >
          <Svg width={20} height={20} viewBox="0 0 20 20">
            {playing ? (
              <>
                <Rect x={4} y={3} width={4} height={14} rx={1} fill={colors.text} />
                <Rect x={12} y={3} width={4} height={14} rx={1} fill={colors.text} />
              </>
            ) : (
              <Path d="M6 3.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L7.5 2.64A1 1 0 0 0 6 3.5Z" fill={colors.text} />
            )}
          </Svg>
        </Pressable>
        <View style={styles.trackColumn}>
          <View style={styles.bars} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {BARS.map((h, i) => (
              <View
                key={i}
                style={[
                  styles.bar,
                  { height: h },
                  i / BAR_COUNT < progress && styles.barPlayed,
                ]}
              />
            ))}
          </View>
          <Text maxFontSizeMultiplier={1.3} style={styles.status}>
            {status}
          </Text>
        </View>
      </View>

      <Text maxFontSizeMultiplier={1.4} style={styles.caption}>
        This is the voice that wakes you up every morning.
      </Text>
      {error ? (
        <Text maxFontSizeMultiplier={1.4} style={styles.error}>
          {error}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('VoiceRecord')}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        >
          <Text maxFontSizeMultiplier={1.3} style={styles.secondaryLabel}>
            re-record voice
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { marginTop: 0 },
  title: {
    fontFamily: fonts.headingRegular,
    ...typeScale.title1,
    ...opticalLeft(40),
    color: colors.text,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    ...noFakeBold,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.chip,
    borderRadius: radii.card,
    borderCurve: 'continuous',
    padding: spacing.lg,
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: accents.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { transform: [{ scale: 0.97 }] },
  trackColumn: { flex: 1, gap: spacing.xs },
  bars: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 32,
  },
  bar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(26, 26, 26, 0.25)',
  },
  barPlayed: { backgroundColor: colors.text },
  status: {
    fontFamily: fonts.body,
    ...typeScale.footnote,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  caption: {
    fontFamily: fonts.body,
    ...typeScale.subhead,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  error: {
    fontFamily: fonts.body,
    ...typeScale.subhead,
    color: accents.danger,
    marginTop: spacing.xs,
  },
  actions: {
    marginTop: 'auto',
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  secondary: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontFamily: fonts.bodyMedium,
    ...typeScale.body,
    color: colors.text,
    textDecorationLine: 'underline',
    ...noFakeBold,
  },
});
