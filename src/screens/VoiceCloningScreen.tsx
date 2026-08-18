import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton } from '../components/BackButton';
import { BubbleEnter } from '../components/BubbleEnter';
import { RoundArrowButton } from '../components/RoundArrowButton';
import { WaitingView } from '../components/WaitingView';
import { useOnboarding } from '../context/OnboardingContext';
import { RootStackParamList } from '../navigation/types';
import { savePreviewAudio } from '../services/audioPreview';
import {
  buildPreviewLine,
  checkVoiceApiHealth,
  cloneVoiceFromUri,
  generateMorningAlarm,
  synthesizeSpeech,
} from '../services/elevenlabs';
import { colors, fonts, noFakeBold, noFakeLight, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'VoiceCloning'>;

export function VoiceCloningScreen({ navigation }: Props) {
  const { answers, voice, setVoiceId, setPreview } = useOnboarding();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const startedRef = useRef(false);

  const saveGeneratedPreview = useCallback(
    async (voiceId: string, useOpenAi: boolean) => {
      if (useOpenAi) {
        const alarm = await generateMorningAlarm({ voiceId, answers });
        const previewPath = await savePreviewAudio(alarm.base64);
        setPreview(previewPath, alarm.text);
        return;
      }

      const text = buildPreviewLine(answers.name);
      const tts = await synthesizeSpeech({ voiceId, text });
      const previewPath = await savePreviewAudio(tts.base64);
      setPreview(previewPath, text);
    },
    [answers, setPreview]
  );

  const runClone = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!voice.sampleUri) {
        throw new Error('No recording found. Go back and record again.');
      }

      const health = await checkVoiceApiHealth();
      if (!health.hasKey && !health.elevenLabs) {
        throw new Error(
          'Voice server is offline. Run npm run server in the project folder.'
        );
      }

      const clone = await cloneVoiceFromUri({
        uri: voice.sampleUri,
        name: answers.name || 'User',
        mimeType: voice.sampleUri.includes('.webm')
          ? 'audio/webm'
          : 'audio/m4a',
        fileName: voice.sampleUri.includes('.webm')
          ? 'sample.webm'
          : 'sample.m4a',
      });
      setVoiceId(clone.voiceId, false);
      await saveGeneratedPreview(clone.voiceId, health.openai === true);
      navigation.replace('VoicePreview');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Voice cloning failed';
      setLoading(false);
      setError(message);
    }
  }, [
    answers.name,
    navigation,
    saveGeneratedPreview,
    setVoiceId,
    voice.sampleUri,
  ]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void runClone();
  }, [runClone]);

  if (loading) {
    return <WaitingView />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <View style={styles.page}>
        <BackButton />
        <BubbleEnter delay={40} fromY={14} style={styles.content}>
        <Text style={styles.title}>Couldn’t clone yet</Text>
        <Text style={styles.error} numberOfLines={8}>
          {error}
        </Text>
        <Text style={styles.hint}>
          Check your ElevenLabs plan supports voice cloning, then try again or
          re-record in a quiet room.
        </Text>

        <View style={styles.footer}>
          <Pressable
            onPress={() => navigation.replace('VoiceRecord')}
            style={styles.linkBtn}
          >
            <Text style={styles.linkText}>re-record</Text>
          </Pressable>
          <RoundArrowButton
            onPress={() => void runClone()}
            color={colors.fab}
          />
        </View>
      </BubbleEnter>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  page: {
    flex: 1,
    paddingHorizontal: spacing.inset,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  title: {
    fontFamily: fonts.headingRegular,
    fontSize: 28,
    color: colors.text,
    textAlign: 'center',
    ...noFakeBold,
  },
  error: {
    fontSize: 13,
    color: '#C0392B',
    textAlign: 'center',
    lineHeight: 20,
  },
  hint: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  linkBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  linkText: {
    fontFamily: fonts.bodyLight,
    fontSize: 15,
    color: colors.textMuted,
    textDecorationLine: 'underline',
    ...noFakeLight,
  },
});
