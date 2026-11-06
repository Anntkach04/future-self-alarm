import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton } from '../components/BackButton';
import { BubbleEnter } from '../components/BubbleEnter';
import { RoundArrowButton } from '../components/RoundArrowButton';
import { useOnboarding } from '../context/OnboardingContext';
import { RootStackParamList } from '../navigation/types';
import { TEMP_ELEVENLABS_TTS_ONLY } from '../config/devBypass';
import { LoadingLabel } from '../components/LoadingLabel';
import { cloneOnboardingVoice } from '../services/cloneOnboardingVoice';
import { colors, fonts, noFakeBold, noFakeLight, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'VoiceCloning'>;

export function VoiceCloningScreen({ navigation }: Props) {
  const { answers, voice, setVoiceId, setPreview } = useOnboarding();
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const runClone = useCallback(async () => {
    setError(null);
    try {
      if (!voice.sampleUri && !TEMP_ELEVENLABS_TTS_ONLY) {
        throw new Error('No recording found. Go back and record again.');
      }
      const result = await cloneOnboardingVoice({
        sampleUri: voice.sampleUri,
        answers,
      });
      setVoiceId(result.voiceId, result.isDemo);
      setPreview(result.previewPath, result.previewText);
      navigation.replace('VoicePreview');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Voice cloning failed');
    }
  }, [answers, navigation, setPreview, setVoiceId, voice.sampleUri]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void runClone();
  }, [runClone]);

  if (!error) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
        <View style={styles.page}>
          <LoadingLabel text="Cloning your voice" style={styles.quiet} />
          <Text maxFontSizeMultiplier={1.5} style={styles.eta}>This usually takes about 1-2 minutes</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <View style={styles.page}>
        <BackButton />
        <BubbleEnter delay={40} fromY={14} style={styles.content}>
        <Text maxFontSizeMultiplier={1.2} style={styles.title}>couldn’t clone yet</Text>
        <Text maxFontSizeMultiplier={1.5} style={styles.error} numberOfLines={8}>
          {error}
        </Text>
        <Text maxFontSizeMultiplier={1.5} style={styles.hint}>
          Check Wi-Fi, that the voice server is online, then try again or
          re-record in a quiet room.
        </Text>

        <View style={styles.footer}>
          <Pressable
            onPress={() => navigation.replace('VoiceRecord')}
            style={styles.linkBtn}
          >
            <Text maxFontSizeMultiplier={1.5} style={styles.linkText}>re-record</Text>
          </Pressable>
          <RoundArrowButton
            onPress={() => {
              startedRef.current = false;
              void runClone();
            }}
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  quiet: {
    fontFamily: fonts.bodyLight,
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    ...noFakeLight,
  },
  eta: {
    marginTop: 10,
    fontFamily: fonts.bodyLight,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'center',
    opacity: 0.85,
    ...noFakeLight,
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
