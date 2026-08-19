import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlarmDayPicker } from '../components/AlarmDayPicker';
import { AppleTimePicker } from '../components/AppleTimePicker';
import { BackButton } from '../components/BackButton';
import { BubbleEnter } from '../components/BubbleEnter';
import { RoundArrowButton } from '../components/RoundArrowButton';
import { useOnboarding } from '../context/OnboardingContext';
import { RootStackParamList } from '../navigation/types';
import { ensureNotificationPermissions } from '../services/alarmScheduler';
import { colors, fonts, headingClipFix, noFakeBold, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'WakeUpTime'>;

export function WakeUpTimeScreen({ navigation }: Props) {
  const { answers, setWakeTime, setWakeDays } = useOnboarding();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.page}>
        <View style={styles.header}>
          <BackButton style={styles.back} />
          <BubbleEnter delay={0} fromY={16}>
            <Text style={styles.question}>
              {"What time should\nFuture You wake\nyou up?"}
            </Text>
          </BubbleEnter>
          <BubbleEnter delay={50} fromY={12}>
            <Text style={styles.subtitle}>
              Choose when you’d like to hear your morning message.
            </Text>
          </BubbleEnter>
        </View>

        <View style={styles.timeZone}>
          <BubbleEnter delay={80} fromY={10}>
            <AppleTimePicker
              compact
              hour={answers.wakeHour}
              minute={answers.wakeMinute}
              onChange={setWakeTime}
            />
          </BubbleEnter>
        </View>

        <View style={styles.footer}>
          <BubbleEnter delay={90} fromY={8}>
            <AlarmDayPicker days={answers.wakeDays} onChange={setWakeDays} />
          </BubbleEnter>
          <Text style={styles.helper}>You can change this anytime.</Text>
          <View style={styles.nextRow}>
            <RoundArrowButton
              onPress={() => {
                void ensureNotificationPermissions();
                navigation.navigate('VoiceRecord');
              }}
              color={colors.fab}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  page: {
    flex: 1,
    paddingHorizontal: spacing.inset,
    paddingTop: spacing.webTop,
  },
  header: {
    paddingBottom: 8,
  },
  back: {
    marginTop: 0,
    marginBottom: 12,
  },
  question: {
    fontFamily: fonts.headingRegular,
    color: colors.text,
    fontSize: 36,
    lineHeight: 44,
    textAlign: 'left',
    marginBottom: 16,
    ...noFakeBold,
    ...headingClipFix,
  },
  subtitle: {
    fontFamily: fonts.bodyLight,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  timeZone: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 120,
    paddingVertical: 24,
  },
  footer: {
    paddingTop: 8,
    paddingBottom: spacing.inset,
    gap: 12,
  },
  helper: {
    fontFamily: fonts.bodyLight,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  nextRow: {
    alignItems: 'flex-end',
    marginTop: 4,
  },
});
