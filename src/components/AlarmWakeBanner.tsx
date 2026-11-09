import { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAlarms } from '../context/AlarmsContext';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSettings } from '../context/AppSettingsContext';
import {
  dismissAlarm,
  playAlarmAudio,
  snoozeRingingAlarm,
  stopAlarmPlayback,
  subscribeAlarmRing,
} from '../services/alarmScheduler';
import { accents, fonts, noFakeBold, spacing } from '../theme';

/**
 * Wake screen is seen in a dark bedroom, eyes half-open — dark, warm, low
 * glare. Cream text on night ink; the one bright thing is "I'm up".
 */
const NIGHT = {
  bg: '#14161F',
  text: '#FFF6E5',
  muted: 'rgba(255, 246, 229, 0.68)',
  line: 'rgba(255, 246, 229, 0.28)',
  ink: '#14161F',
};

type Ring = { alarmId: string; audioUri: string | null };

/**
 * In-app wake sheet when a Future Self alarm fires (notification path / after Kit).
 * Dashboard toggle stays enable/disable — Snooze lives only here.
 */
export function AlarmWakeBanner() {
  const [ring, setRing] = useState<Ring | null>(null);
  const { recordMorningKept } = useAppSettings();
  const { alarms } = useAlarms();
  const insets = useSafeAreaInsets();
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    return subscribeAlarmRing((next) => {
      setRing(
        next?.alarmId
          ? { alarmId: next.alarmId, audioUri: next.audioUri ?? null }
          : null
      );
    });
  }, []);

  if (!ring || Platform.OS === 'web') return null;

  const alarm = alarms.find((a) => a.id === ring.alarmId);
  const audioUri = ring.audioUri ?? alarm?.audioUri ?? null;
  const script = alarm?.scriptText?.trim() || '';

  // The lock-screen ring already played the message; replay is on request.
  const onPlay = () => {
    if (!audioUri) return;
    if (playing) {
      void stopAlarmPlayback();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    void playAlarmAudio(audioUri, { vibrate: false })
      .catch(() => undefined)
      .finally(() => setTimeout(() => setPlaying(false), 30000));
  };

  const onUp = () => {
    setPlaying(false);
    recordMorningKept();
    void dismissAlarm(ring.alarmId);
  };

  const onSnooze = () => {
    setPlaying(false);
    void snoozeRingingAlarm(ring.alarmId, ring.audioUri, 10);
  };

  return (
    <Modal
      visible
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onUp}
    >
      <StatusBar style="light" />
      <View
        style={[
          styles.screen,
          {
            paddingTop: Math.max(insets.top, 24) + 24,
            paddingBottom: Math.max(insets.bottom, 24) + 16,
          },
        ]}
      >
        <Text style={styles.kicker} maxFontSizeMultiplier={1.4}>
          Good morning
        </Text>
        <Text
          style={styles.title}
          maxFontSizeMultiplier={1.15}
          accessibilityRole="header"
        >
          Future you{'\n'}is here
        </Text>
        {script ? (
          <ScrollView style={styles.scriptBox} showsVerticalScrollIndicator={false}>
            <Text style={styles.script} maxFontSizeMultiplier={1.4} lineBreakStrategyIOS="push-out">
              {script}
            </Text>
          </ScrollView>
        ) : (
          <Text style={styles.body} maxFontSizeMultiplier={1.4} lineBreakStrategyIOS="push-out">
            Tap I’m up when you’re awake, or snooze for 10 minutes.
          </Text>
        )}
        {audioUri ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={playing ? 'Stop message' : 'Play message again'}
            onPress={onPlay}
            hitSlop={8}
            style={styles.replay}
          >
            <Text style={styles.replayText} maxFontSizeMultiplier={1.3}>
              {playing ? 'stop' : 'play again'}
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Snooze 10 minutes"
            onPress={onSnooze}
            style={styles.secondary}
          >
            <Text style={styles.secondaryText} maxFontSizeMultiplier={1.3}>
              snooze 10 min
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="I'm up"
            onPress={onUp}
            style={styles.primary}
          >
            <Text style={styles.primaryText} maxFontSizeMultiplier={1.3}>
              i’m up
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: NIGHT.bg,
    paddingHorizontal: spacing.inset,
  },
  kicker: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: NIGHT.muted,
    marginBottom: 12,
  },
  title: {
    fontFamily: fonts.headingRegular,
    fontSize: 48,
    lineHeight: 52,
    color: NIGHT.text,
    marginBottom: 20,
    ...noFakeBold,
  },
  body: {
    fontFamily: fonts.bodyLight,
    fontSize: 18,
    lineHeight: 26,
    color: NIGHT.muted,
    maxWidth: 320,
  },
  scriptBox: {
    flexGrow: 0,
    maxHeight: 260,
  },
  script: {
    fontFamily: fonts.body,
    fontSize: 18,
    lineHeight: 28,
    color: NIGHT.text,
  },
  replay: {
    alignSelf: 'flex-start',
    marginTop: 20,
    borderWidth: 1,
    borderColor: NIGHT.line,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  replayText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: NIGHT.text,
  },
  footer: {
    marginTop: 'auto',
    gap: 12,
  },
  secondary: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: NIGHT.line,
    borderRadius: 999,
    paddingVertical: 18,
    alignItems: 'center',
  },
  secondaryText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 18,
    color: NIGHT.text,
  },
  primary: {
    alignSelf: 'stretch',
    backgroundColor: accents.lime,
    borderRadius: 999,
    paddingVertical: 18,
    alignItems: 'center',
  },
  primaryText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 18,
    color: NIGHT.ink,
  },
});
