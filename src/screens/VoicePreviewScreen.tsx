import { Audio } from 'expo-av';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { RoundArrowButton } from '../components/RoundArrowButton';
import { useAlarms } from '../context/AlarmsContext';
import { useOnboarding } from '../context/OnboardingContext';
import { RootStackParamList } from '../navigation/types';
import { buildPreviewLine } from '../services/elevenlabs';
import { colors, fonts, noFakeLight, radii, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'VoicePreview'>;

export function VoicePreviewScreen({ navigation }: Props) {
  const { answers, voice, markOnboardingComplete } = useOnboarding();
  const { alarms } = useAlarms();
  const [playing, setPlaying] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const line = voice.previewText || buildPreviewLine(answers.name);

  useEffect(() => {
    return () => {
      sound?.unloadAsync();
    };
  }, [sound]);

  const play = async () => {
    if (!voice.previewUri) return;
    if (sound) await sound.unloadAsync();
    const { sound: next } = await Audio.Sound.createAsync(
      { uri: voice.previewUri },
      { shouldPlay: true }
    );
    setSound(next);
    setPlaying(true);
    next.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) return;
      if (status.didJustFinish) setPlaying(false);
    });
  };

  const continueNext = () => {
    markOnboardingComplete();
    if (alarms.length === 0) {
      navigation.replace('CreateAlarm');
      return;
    }
    navigation.replace('Home');
  };

  return (
    <Screen>
      <View style={styles.content}>
        <Text style={styles.kicker}>Voice ready</Text>
        <Text style={styles.title}>This is you from the future</Text>
        <ScrollView
          style={styles.script}
          contentContainerStyle={styles.scriptInner}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.body}>{line}</Text>
        </ScrollView>

        <Pressable style={styles.playBtn} onPress={play}>
          <Text style={styles.playText}>
            {playing ? 'Playing…' : 'Play AI voice preview'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => navigation.replace('VoiceRecord')}
          style={styles.linkBtn}
        >
          <Text style={styles.linkText}>re-record</Text>
        </Pressable>
        <RoundArrowButton onPress={continueNext} color={colors.fab} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingTop: spacing.lg,
  },
  kicker: {
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.headingRegular,
    fontWeight: '400',
    fontSize: 32,
    color: colors.text,
    marginBottom: spacing.md,
  },
  script: {
    flexGrow: 1,
    flexShrink: 1,
    marginBottom: spacing.md,
  },
  scriptInner: {
    paddingBottom: spacing.sm,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 18,
    lineHeight: 28,
    color: colors.text,
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
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
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
