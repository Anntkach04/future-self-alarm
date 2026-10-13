import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LoadingLabel } from '../components/LoadingLabel';
import { Screen } from '../components/Screen';
import { RoundArrowButton } from '../components/RoundArrowButton';
import { useAppSettings } from '../context/AppSettingsContext';
import { useOnboarding } from '../context/OnboardingContext';
import { RootStackParamList } from '../navigation/types';
import { buildAlarmScript } from '../data/alarmScript';
import { colors, fonts, noFakeLight, radii, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'VoicePreview'>;

export function VoicePreviewScreen({ navigation }: Props) {
  const { answers, voice } = useOnboarding();
  const { appleUserId, notificationsReady } = useAppSettings();
  const [playing, setPlaying] = useState(false);
  const playerRef = useRef<AudioPlayer | null>(null);
  const line = voice.previewText || buildAlarmScript(answers.name);

  useEffect(() => {
    return () => {
      playerRef.current?.remove();
      playerRef.current = null;
    };
  }, []);

  const play = async () => {
    if (!voice.previewUri) return;
    playerRef.current?.remove();
    const player = createAudioPlayer({ uri: voice.previewUri });
    playerRef.current = player;
    player.play();
    setPlaying(true);
    player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) setPlaying(false);
    });
  };

  const continueNext = () => {
    // Account → alerts → trial → alarm → home
    if (!appleUserId) {
      navigation.replace('SignIn');
      return;
    }
    if (!notificationsReady) {
      navigation.replace('NotificationPermission');
      return;
    }
    navigation.replace('Paywall');
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
          {playing ? (
            <LoadingLabel text="Playing" style={styles.playText} />
          ) : (
            <Text style={styles.playText}>Play your voice</Text>
          )}
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
    gap: 16,
  },
  kicker: {
    fontFamily: fonts.bodyLight,
    fontSize: 14,
    color: colors.text,
    opacity: 0.6,
  },
  title: {
    fontFamily: fonts.headingRegular,
    fontSize: 36,
    lineHeight: 42,
    color: colors.text,
  },
  script: {
    flex: 1,
  },
  scriptInner: {
    paddingBottom: 12,
  },
  body: {
    fontFamily: fonts.bodyLight,
    fontSize: 18,
    lineHeight: 26,
    color: colors.text,
    ...noFakeLight,
  },
  playBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.text,
    borderRadius: radii.pill,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  playText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.bg,
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
    fontFamily: fonts.bodyLight,
    fontSize: 16,
    color: colors.text,
    opacity: 0.7,
    ...noFakeLight,
  },
});
