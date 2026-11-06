import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { BackButton } from '../components/BackButton';
import { Screen } from '../components/Screen';
import { RoundArrowButton } from '../components/RoundArrowButton';
import { SwipeDeleteRow } from '../components/SwipeDeleteRow';
import {
  formatAlarmDays,
  formatAlarmTime,
  useAlarms,
} from '../context/AlarmsContext';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Alarms'>;

export function AlarmsScreen({ navigation }: Props) {
  const { alarms, toggleAlarm, removeAlarm } = useAlarms();

  return (
    <Screen>
      <BackButton style={styles.back} />
      <View style={styles.header}>
        <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.title}>alarms</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {alarms.length === 0 ? (
          <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.empty}>
            No wakes yet. Tap + to set the first morning with your voice.
          </Text>
        ) : (
          alarms.map((alarm) => (
            <SwipeDeleteRow
              key={alarm.id}
              onDelete={() => removeAlarm(alarm.id)}
              surfaceColor={colors.inputBg}
            >
              <View style={styles.card}>
                <Pressable
                  style={styles.cardMain}
                  onPress={() =>
                    navigation.navigate('CreateAlarm', { alarmId: alarm.id })
                  }
                >
                  <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out"
                    style={[styles.time, !alarm.enabled && styles.dim]}
                  >
                    {formatAlarmTime(alarm)}
                  </Text>
                  <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out"
                    style={[styles.meta, !alarm.enabled && styles.dim]}
                  >
                    {alarm.label} · {formatAlarmDays(alarm.days)}
                  </Text>
                </Pressable>
                <Switch
                  value={alarm.enabled}
                  onValueChange={() => toggleAlarm(alarm.id)}
                  trackColor={{ false: colors.border, true: colors.text }}
                />
              </View>
            </SwipeDeleteRow>
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        <RoundArrowButton
          onPress={() => navigation.navigate('CreateAlarm')}
          color={colors.fab}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: {
    marginTop: 0,
  },
  header: {
    paddingTop: spacing.md,
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: fonts.headingRegular,
    fontWeight: '400',
    fontSize: 36,
    lineHeight: 44,
    color: colors.text,
  },
  list: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  empty: {
    fontFamily: fonts.body,
    color: colors.textMuted,
    marginTop: spacing.xl,
  },
  card: {
    backgroundColor: colors.inputBg,
    borderRadius: 18,
    padding: spacing.md,
    gap: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardMain: {
    gap: 4,
    flex: 1,
  },
  time: {
    fontFamily: fonts.headingRegular,
    fontWeight: '400',
    fontSize: 40,
    lineHeight: 44,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  meta: {
    fontFamily: fonts.body,
    color: colors.textMuted,
  },
  dim: {
    opacity: 0.38,
  },
  footer: {
    alignItems: 'flex-end',
    marginBottom: spacing.md,
  },
});
