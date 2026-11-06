import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton } from '../components/BackButton';
import { BubbleEnter } from '../components/BubbleEnter';
import { RoundArrowButton } from '../components/RoundArrowButton';
import { useOnboarding } from '../context/OnboardingContext';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, noFakeBold, radii, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'VoiceReview'>;

export function VoiceReviewScreen({ navigation }: Props) {
  const { voice } = useOnboarding();
  const [playing, setPlaying] = useState(false);
  const playerRef = useRef<AudioPlayer | null>(null);

  useEffect(() => {
    return () => {
      playerRef.current?.remove();
      playerRef.current = null;
    };
  }, []);

  const play = async () => {
    if (!voice.sampleUri) return;
    playerRef.current?.remove();
    const player = createAudioPlayer({ uri: voice.sampleUri });
    playerRef.current = player;
    player.play();
    setPlaying(true);
    player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) setPlaying(false);
    });
  };

  const stop = async () => {
    playerRef.current?.pause();
    setPlaying(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <BackButton />
      <BubbleEnter delay={40} fromY={14} style={styles.content}>
        <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.kicker}>Review</Text>
        <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.title}>listen to your take</Text>
        <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.body}>
          Duration: {voice.sampleDurationSec}s. If it sounds clear, we’ll clone it with ElevenLabs.
        </Text>

        <Pressable style={styles.playBtn} onPress={playing ? stop : play}>
          <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.playText}>{playing ? 'Stop' : 'Play recording'}</Text>
        </Pressable>
      </BubbleEnter>

      <BubbleEnter delay={200} fromY={10} style={styles.footer}>
        <Pressable
          onPress={() => navigation.replace('VoiceRecord')}
          style={styles.linkBtn}
        >
          <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.linkText}>re-record</Text>
        </Pressable>
        <RoundArrowButton
          onPress={() => navigation.navigate('VoiceCloning')}
          color={colors.fab}
        />
      </BubbleEnter>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.inset,
    paddingBottom: spacing.inset,
  },
  content: {
    flex: 1,
    gap: 12,
    paddingTop: 72,
  },
  kicker: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    opacity: 0.6,
  },
  title: {
    fontFamily: fonts.headingRegular,
    fontSize: 36,
    lineHeight: 44,
    color: colors.text,
    ...noFakeBold,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  playBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: colors.text,
    borderRadius: radii.button,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  playText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.bg,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
