import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BackButton } from '../components/BackButton';
import { PlayVoiceButton, VoiceLevelBars } from '../components/VoicePlayback';
import { cleanScript } from '../components/KaraokeScript';
import { Screen } from '../components/Screen';
import { TextArrowButton } from '../components/TextArrowButton';
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
  spacing,
  typeScale,
} from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'VoiceSettings'>;

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
  /** Current player, for the level bars (state so they re-subscribe). */
  const [player, setPlayer] = useState<AudioPlayer | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const subRef = useRef<{ remove: () => void } | null>(null);

  const detach = () => {
    subRef.current?.remove();
    subRef.current = null;
    playerRef.current?.remove();
    playerRef.current = null;
    setPlayer(null);
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
      setPlayer(player);
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
        Your voice
      </Text>
      <Text maxFontSizeMultiplier={1.4} style={styles.caption}>
        This is the voice that wakes you up every morning.
      </Text>

      <View style={styles.stage}>
        <VoiceLevelBars player={player} playing={playing} />
        <PlayVoiceButton playing={playing} busy={busy} onPress={() => void play()} />
        <Text maxFontSizeMultiplier={1.3} style={styles.status}>
          {status}
        </Text>
        {error ? (
          <Text maxFontSizeMultiplier={1.4} style={styles.error}>
            {error}
          </Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        {/* Goes straight to the karaoke recorder; the old voice stays until
            the new one is cloned. */}
        <TextArrowButton
          wide
          label="re-record voice"
          color={accents.lilac}
          onPress={() => navigation.navigate('VoiceRecord')}
        />
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
    marginBottom: spacing.xs,
    ...noFakeBold,
  },
  caption: {
    fontFamily: fonts.body,
    ...typeScale.subhead,
    color: colors.textMuted,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  status: {
    fontFamily: fonts.body,
    ...typeScale.subhead,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  error: {
    fontFamily: fonts.body,
    ...typeScale.subhead,
    color: accents.danger,
    textAlign: 'center',
  },
  actions: {
    paddingBottom: spacing.md,
    alignItems: 'stretch',
  },
});
