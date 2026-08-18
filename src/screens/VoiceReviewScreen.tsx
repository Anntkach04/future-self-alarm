import { Audio } from 'expo-av';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton } from '../components/BackButton';
import { BubbleEnter } from '../components/BubbleEnter';
import { RoundArrowButton } from '../components/RoundArrowButton';
import { useOnboarding } from '../context/OnboardingContext';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, noFakeBold, noFakeLight, radii, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'VoiceReview'>;

export function VoiceReviewScreen({ navigation }: Props) {
  const { voice } = useOnboarding();
  const [playing, setPlaying] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      sound?.unloadAsync();
    };
  }, [sound]);

  const play = async () => {
    if (!voice.sampleUri) return;
    if (sound) {
      await sound.unloadAsync();
    }
    const { sound: next } = await Audio.Sound.createAsync(
      { uri: voice.sampleUri },
      { shouldPlay: true }
    );
    setSound(next);
    setPlaying(true);
    next.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) return;
      if (status.didJustFinish) setPlaying(false);
    });
  };

  const stop = async () => {
    await sound?.stopAsync();
    setPlaying(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <BackButton />
      <BubbleEnter delay={40} fromY={14} style={styles.content}>
        <Text style={styles.kicker}>Review</Text>
        <Text style={styles.title}>Listen to your take</Text>
        <Text style={styles.body}>
          Duration: {voice.sampleDurationSec}s. If it sounds clear, we’ll clone it with ElevenLabs.
        </Text>

        <Pressable style={styles.playBtn} onPress={playing ? stop : play}>
          <Text style={styles.playText}>{playing ? 'Stop' : 'Play recording'}</Text>
        </Pressable>
      </BubbleEnter>

      <BubbleEnter delay={200} fromY={10} style={styles.footer}>
        <Pressable
          onPress={() => navigation.replace('VoiceRecord')}
          style={styles.linkBtn}
        >
          <Text style={styles.linkText}>re-record</Text>
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
    paddingBottom: spacing.lg,
  },
  content: {
    flex: 1,
  },
  kicker: {
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.headingRegular,
    fontSize: 30,
    color: colors.text,
    marginBottom: spacing.md,
    ...noFakeBold,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
    marginBottom: spacing.xl,
  },
  playBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.inputBg,
    borderRadius: radii.input,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  playText: {
    fontFamily: fonts.bodyLight,
    fontSize: 16,
    color: colors.text,
    ...noFakeLight,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
