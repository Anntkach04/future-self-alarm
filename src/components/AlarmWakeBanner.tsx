import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import {
  dismissAlarm,
  subscribeAlarmRing,
} from '../services/alarmScheduler';
import { accents, colors, fonts, noFakeBold, spacing } from '../theme';
import { TextArrowButton } from './TextArrowButton';

export function AlarmWakeBanner() {
  const [alarmId, setAlarmId] = useState<string | null>(null);

  useEffect(() => {
    return subscribeAlarmRing((next) => {
      setAlarmId(next?.alarmId ?? null);
    });
  }, []);

  if (!alarmId || Platform.OS === 'web') return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Future You is here</Text>
      <Text style={styles.body}>
        Tap when you’re up — otherwise this plays again in 10 minutes.
      </Text>
      <TextArrowButton
        label="I'm up"
        color={accents.lime}
        onPress={() => void dismissAlarm(alarmId)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.inset,
    right: spacing.inset,
    bottom: 28,
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: colors.text,
    borderRadius: 24,
    padding: 18,
    gap: 10,
    zIndex: 40,
  },
  title: {
    fontFamily: fonts.headingRegular,
    fontSize: 26,
    color: colors.text,
    ...noFakeBold,
  },
  body: {
    fontFamily: fonts.bodyLight,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
  },
});
