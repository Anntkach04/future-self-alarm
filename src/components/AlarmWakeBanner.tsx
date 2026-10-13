import { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSettings } from '../context/AppSettingsContext';
import {
  dismissAlarm,
  subscribeAlarmRing,
} from '../services/alarmScheduler';
import { accents, colors, fonts, noFakeBold, spacing } from '../theme';

export function AlarmWakeBanner() {
  const [alarmId, setAlarmId] = useState<string | null>(null);
  const { recordMorningKept } = useAppSettings();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    return subscribeAlarmRing((next) => {
      setAlarmId(next?.alarmId ?? null);
    });
  }, []);

  if (!alarmId || Platform.OS === 'web') return null;

  const onUp = () => {
    recordMorningKept();
    void dismissAlarm(alarmId);
  };

  return (
    <Modal
      visible
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onUp}
    >
      <View
        style={[
          styles.screen,
          {
            paddingTop: Math.max(insets.top, 24) + 24,
            paddingBottom: Math.max(insets.bottom, 24) + 16,
          },
        ]}
      >
        <Text style={styles.kicker}>Good morning</Text>
        <Text style={styles.title}>Future You{'\n'}is here</Text>
        <Text style={styles.body}>
          Your voice is playing. Tap I&apos;m up to stop the next rings. If you
          wait, the system will wake you again in a few minutes.
        </Text>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="I'm up"
            onPress={onUp}
            style={styles.primary}
          >
            <Text style={styles.primaryText}>I&apos;m up</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#BADFFF',
    paddingHorizontal: spacing.inset,
  },
  kicker: {
    fontFamily: fonts.bodyLight,
    fontSize: 16,
    color: colors.text,
    marginBottom: 12,
    opacity: 0.8,
  },
  title: {
    fontFamily: fonts.headingRegular,
    fontSize: 48,
    lineHeight: 52,
    color: colors.text,
    marginBottom: 20,
    ...noFakeBold,
  },
  body: {
    fontFamily: fonts.bodyLight,
    fontSize: 18,
    lineHeight: 26,
    color: colors.text,
    maxWidth: 320,
  },
  footer: {
    marginTop: 'auto',
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
    color: colors.text,
  },
});
