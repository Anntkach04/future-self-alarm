import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from 'expo-audio';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { KaraokeScript, type KaraokeWord } from '../components/KaraokeScript';
import { LoadingLabel } from '../components/LoadingLabel';
import { Screen } from '../components/Screen';
import { RoundArrowButton } from '../components/RoundArrowButton';
import { TextArrowButton } from '../components/TextArrowButton';
import { useAppSettings } from '../context/AppSettingsContext';
import { useOnboarding } from '../context/OnboardingContext';
import { RootStackParamList } from '../navigation/types';
import { buildAlarmScript } from '../data/alarmScript';
import { ensureGuestSession } from '../services/apiAuth';
import { savePreviewAudio } from '../services/audioPreview';
import { synthesizeSpeech } from '../services/elevenlabs';
import { userFacingError } from '../services/userFacingError';
import { accents, colors, fonts, noFakeBold, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'VoicePreview'>;

function playableUri(uri: string) {
  if (
    uri.startsWith('file://') ||
    uri.startsWith('http') ||
    uri.startsWith('blob:')
  ) {
    return uri;
  }
  return `file://${uri}`;
}

/** Even spacing when ElevenLabs alignment is missing — still looks like karaoke. */
function estimateWords(text: string, durationSec: number): KaraokeWord[] {
  const parts = text.split(/\s+/).filter(Boolean);
  if (!parts.length) return [];
  const dur = Math.max(durationSec, parts.length * 0.28);
  const slot = dur / parts.length;
  return parts.map((w, i) => ({
    text: w,
    start: i * slot,
    end: (i + 1) * slot,
  }));
}

export function VoicePreviewScreen({ navigation }: Props) {
  const { answers, voice, setPreview } = useOnboarding();
  const { notificationsReady, alarmKitReady, appleUserId } = useAppSettings();
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [words, setWords] = useState<KaraokeWord[] | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const statusSubRef = useRef<{ remove: () => void } | null>(null);
  const previewCacheRef = useRef<{
    uri: string;
    words: KaraokeWord[] | null;
  } | null>(null);
  const line =
    voice.previewText ||
    buildAlarmScript(answers.name, null, answers.morningHabits);

  const detachPlayer = () => {
    statusSubRef.current?.remove();
    statusSubRef.current = null;
    playerRef.current?.remove();
    playerRef.current = null;
  };

  useEffect(() => {
    return () => {
      detachPlayer();
    };
  }, []);

  /** Prefetch TTS + word timings so karaoke is ready on first play. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!voice.voiceId) return;
      try {
        await ensureGuestSession();
        const text =
          voice.previewText ||
          buildAlarmScript(answers.name, null, answers.morningHabits);
        const tts = await synthesizeSpeech({
          voiceId: voice.voiceId,
          text,
          withTimestamps: true,
        });
        if (cancelled) return;
        const path = await savePreviewAudio(tts.base64);
        const nextWords = Array.isArray(tts.words) && tts.words.length
          ? (tts.words as KaraokeWord[])
          : null;
        setPreview(path, text);
        setWords(nextWords);
        previewCacheRef.current = { uri: path, words: nextWords };
      } catch {
        // Play will retry; keep screen quiet.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [voice.voiceId, voice.previewText, answers.name, answers.morningHabits, setPreview]);

  const ensurePreviewUri = async (): Promise<{
    uri: string;
    words: KaraokeWord[] | null;
  } | null> => {
    if (previewCacheRef.current?.uri) {
      return previewCacheRef.current;
    }
    if (!voice.voiceId) return null;
    await ensureGuestSession();
    const text =
      voice.previewText ||
      buildAlarmScript(answers.name, null, answers.morningHabits);
    const tts = await synthesizeSpeech({
      voiceId: voice.voiceId,
      text,
      withTimestamps: true,
    });
    const path = await savePreviewAudio(tts.base64);
    setPreview(path, text);
    const nextWords = Array.isArray(tts.words) && tts.words.length
      ? (tts.words as KaraokeWord[])
      : null;
    setWords(nextWords);
    previewCacheRef.current = { uri: path, words: nextWords };
    return previewCacheRef.current;
  };

  const play = async () => {
    if (busy || playing) return;
    setBusy(true);
    setError(null);
    setCurrentTime(0);
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
      });
      const ready = await ensurePreviewUri();
      if (!ready?.uri) {
        setError('Preview audio is not ready yet. Try again in a moment.');
        return;
      }
      detachPlayer();
      // Fast status ticks so word highlight tracks speech (default is 500ms).
      const player = createAudioPlayer(
        { uri: playableUri(ready.uri) },
        { updateInterval: 40 }
      );
      playerRef.current = player;
      statusSubRef.current = player.addListener(
        'playbackStatusUpdate',
        (status) => {
          const t = Number(status.currentTime) || 0;
          setCurrentTime(t);
          if (
            (!ready.words || ready.words.length === 0) &&
            status.duration > 0.5
          ) {
            const estimated = estimateWords(line, status.duration);
            if (estimated.length) {
              setWords(estimated);
              previewCacheRef.current = {
                uri: ready.uri,
                words: estimated,
              };
            }
          }
          if (status.didJustFinish) {
            setPlaying(false);
            setCurrentTime(0);
          }
        }
      );
      player.play();
      setPlaying(true);
      if (ready.words?.length) setWords(ready.words);
    } catch (e) {
      setPlaying(false);
      setCurrentTime(0);
      setError(userFacingError(e, 'Could not play preview'));
    } finally {
      setBusy(false);
    }
  };

  const continueNext = () => {
    // Value first: the user has heard their voice — now ask them to save it.
    if (!appleUserId) {
      navigation.navigate('SignIn', { mode: 'save' });
      return;
    }
    if (!notificationsReady || !alarmKitReady) {
      navigation.replace('AlarmPermission');
      return;
    }
    navigation.replace('Paywall');
  };

  return (
    <Screen>
      <View style={styles.stage}>
        <View style={styles.centerBlock}>
          <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.heading}>Voice is ready</Text>
          <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.subheading}>This is you from the future</Text>
          <View style={styles.scriptWrap}>
            <KaraokeScript
              text={line}
              words={words}
              currentTime={currentTime}
              active={playing}
            />
          </View>

          {error ? <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.error}>{error}</Text> : null}

          <View style={styles.playRow}>
            {playing || busy ? (
              <LoadingLabel
                text={playing ? 'Playing' : 'Loading'}
                style={styles.loading}
              />
            ) : (
              <TextArrowButton
                label="play your voice"
                color={accents.gold}
                onPress={() => void play()}
                disabled={busy}
              />
            )}
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => navigation.replace('VoiceRecord')}
          style={styles.linkBtn}
        >
          <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.linkText}>redo</Text>
        </Pressable>
        <RoundArrowButton onPress={continueNext} color={colors.fab} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  centerBlock: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: 18,
  },
  heading: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
    opacity: 0.65,
    textAlign: 'center',
  },
  subheading: {
    fontFamily: fonts.headingRegular,
    fontSize: 36,
    lineHeight: 44,
    color: colors.text,
    textAlign: 'center',
    ...noFakeBold,
  },
  scriptWrap: {
    width: '100%',
    maxWidth: 320,
    paddingHorizontal: 4,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: '#C0392B',
    textAlign: 'center',
  },
  playRow: {
    marginTop: 4,
    alignItems: 'center',
  },
  loading: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.text,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.inset,
  },
  linkBtn: {
    paddingVertical: 8,
  },
  linkText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    opacity: 0.7,
  },
});
