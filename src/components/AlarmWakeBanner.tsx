import { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSettings } from '../context/AppSettingsContext';
import {
  dismissAlarm,
  snoozeRingingAlarm,
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
  const insets = useSafeAreaInsets();

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

  const onUp = () => {
    recordMorningKept();
    void dismissAlarm(ring.alarmId);
  };

  const onSnooze = () => {
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
          good morning
        </Text>
        <Text
          style={styles.title}
          maxFontSizeMultiplier={1.15}
          accessibilityRole="header"
        >
          future you{'\n'}is here
        </Text>
        <Text style={styles.body} maxFontSizeMultiplier={1.4}>
          Your voice is playing. Tap I&apos;m up when you&apos;re awake, or
          snooze for 10 minutes — your regular schedule stays on.
        </Text>

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
              i&apos;m up
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
    fontFamily: fonts.bodyLight,
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
