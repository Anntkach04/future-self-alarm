import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { BackButton } from '../components/BackButton';
import { Screen } from '../components/Screen';
import { RoundArrowButton } from '../components/RoundArrowButton';
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
        <Text style={styles.title}>Alarms</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {alarms.length === 0 ? (
          <Text style={styles.empty}>No alarms yet.</Text>
        ) : (
          alarms.map((alarm) => (
            <View key={alarm.id} style={styles.card}>
              <Pressable
                style={styles.cardMain}
                onPress={() =>
                  navigation.navigate('CreateAlarm', { alarmId: alarm.id })
                }
              >
                <Text style={styles.time}>{formatAlarmTime(alarm)}</Text>
                <Text style={styles.meta}>
                  {alarm.label} · {formatAlarmDays(alarm.days)}
                </Text>
              </Pressable>
              <Switch
                value={alarm.enabled}
                onValueChange={() => toggleAlarm(alarm.id)}
                trackColor={{ false: colors.border, true: colors.text }}
              />
              <Pressable
                onPress={() => removeAlarm(alarm.id)}
                hitSlop={8}
                style={styles.delete}
              >
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            </View>
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
  },
  cardMain: {
    gap: 4,
  },
  time: {
    fontFamily: fonts.headingRegular,
    fontWeight: '400',
    fontSize: 40,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  meta: {
    fontFamily: fonts.body,
    color: colors.textMuted,
  },
  delete: {
    alignSelf: 'flex-start',
  },
  deleteText: {
    fontFamily: fonts.bodyLight,
    color: '#C0392B',
  },
  footer: {
    alignItems: 'flex-end',
    marginBottom: spacing.md,
  },
});
