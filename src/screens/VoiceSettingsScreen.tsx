import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from 'expo-audio';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BackButton } from '../components/BackButton';
import { KaraokeScript, type KaraokeWord } from '../components/KaraokeScript';
import { LoadingLabel } from '../components/LoadingLabel';
import { Screen } from '../components/Screen';
import { TextArrowButton } from '../components/TextArrowButton';
import { useOnboarding } from '../context/OnboardingContext';
import { buildAlarmScript } from '../data/alarmScript';
import { RootStackParamList } from '../navigation/types';
import { ensureGuestSession } from '../services/apiAuth';
import { savePreviewAudio } from '../services/audioPreview';
import { synthesizeSpeech } from '../services/elevenlabs';
import { userFacingError } from '../services/userFacingError';
import { accents, colors, fonts, noFakeBold, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'VoiceSettings'>;

function playableUri(uri: string) {
  if (/^(file:|https?:|blob:)/.test(uri)) return uri;
  return `file://${uri}`;
}

/** Even spacing when word timings are missing — still reads as karaoke. */
function estimateWords(text: string, durationSec: number): KaraokeWord[] {
  const parts = text.split(/\s+/).filter(Boolean);
  if (!parts.length) return [];
  const slot = Math.max(durationSec, parts.length * 0.28) / parts.length;
  return parts.map((w, i) => ({ text: w, start: i * slot, end: (i + 1) * slot }));
}

/**
 * Listen to your cloned voice again, with the same word highlight as the
 * onboarding preview; re-record from here.
 */
export function VoiceSettingsScreen({ navigation }: Props) {
  const { answers, voice, setPreview } = useOnboarding();
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [words, setWords] = useState<KaraokeWord[] | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const subRef = useRef<{ remove: () => void } | null>(null);
  /** Audio + timings made on this screen (reused on replay, no extra cost). */
  const cacheRef = useRef<{ uri: string; words: KaraokeWord[] | null } | null>(null);

  const line =
    voice.previewText ||
    buildAlarmScript(answers.name, null, answers.morningHabits);

  const detach = () => {
    subRef.current?.remove();
    subRef.current = null;
    playerRef.current?.remove();
    playerRef.current = null;
  };
  useEffect(() => () => detach(), []);

  /** Fresh TTS with word timings, once per visit. */
  const ensureAudio = async () => {
    if (cacheRef.current) return cacheRef.current;
    if (!voice.voiceId) return null;
    await ensureGuestSession();
    const tts = await synthesizeSpeech({
      voiceId: voice.voiceId,
      text: line,
      withTimestamps: true,
    });
    const path = await savePreviewAudio(tts.base64);
    setPreview(path, line);
    const timed =
      Array.isArray(tts.words) && tts.words.length
        ? (tts.words as KaraokeWord[])
        : null;
    setWords(timed);
    cacheRef.current = { uri: path, words: timed };
    return cacheRef.current;
  };

  const play = async () => {
    if (busy || playing) return;
    setBusy(true);
    setError(null);
    setCurrentTime(0);
    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      const ready = await ensureAudio();
      if (!ready) {
        setError('Record your voice first to hear it here.');
        return;
      }
      detach();
      const player = createAudioPlayer(
        { uri: playableUri(ready.uri) },
        { updateInterval: 40 }
      );
      playerRef.current = player;
      subRef.current = player.addListener('playbackStatusUpdate', (status) => {
        setCurrentTime(Number(status.currentTime) || 0);
        if (!ready.words?.length && status.duration > 0.5) {
          const estimated = estimateWords(line, status.duration);
          setWords(estimated);
          cacheRef.current = { uri: ready.uri, words: estimated };
        }
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

  return (
    <Screen>
      <BackButton style={styles.back} />
      <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.title}>Voice</Text>

      <View style={styles.card}>
        <KaraokeScript
          text={line}
          words={words}
          currentTime={currentTime}
          active={playing}
        />
        {error ? (
          <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.error}>{error}</Text>
        ) : null}
        <View style={styles.playRow}>
          {playing || busy ? (
            <LoadingLabel text={playing ? 'Playing' : 'Loading'} style={styles.loading} />
          ) : (
            <TextArrowButton
              label="play your voice"
              color={accents.goldDeep}
              onPress={() => void play()}
            />
          )}
        </View>
      </View>

      <View style={styles.actions}>
        <TextArrowButton
          wide
          label="re-record voice"
          color={colors.fab}
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
    fontSize: 40,
    lineHeight: 44,
    color: colors.text,
    marginTop: 8,
    marginBottom: spacing.lg,
    ...noFakeBold,
  },
  card: {
    backgroundColor: accents.gold,
    borderRadius: 24,
    padding: 22,
    gap: 18,
  },
  playRow: {
    minHeight: 44,
    justifyContent: 'center',
  },
  loading: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  actions: {
    marginTop: 'auto',
    paddingBottom: spacing.md,
  },
});
