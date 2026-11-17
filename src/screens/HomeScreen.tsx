import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { formatDateKey } from '../utils/dates';
import { useMemo } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlarmPermissionNudge } from '../components/AlarmPermissionNudge';
import { MoodCheckInCard } from '../components/MoodCheckInCard';
import { NotificationPermissionNudge } from '../components/NotificationPermissionNudge';
import { TextArrowButton } from '../components/TextArrowButton';
import { useAppSettings } from '../context/AppSettingsContext';
import {
  formatAlarmDays,
  formatAlarmTime,
  useAlarms,
  type Alarm,
} from '../context/AlarmsContext';
import { useOnboarding } from '../context/OnboardingContext';
import { RootStackParamList } from '../navigation/types';
import { accents, colors, fonts, headingClipFix, noFakeBold, spacing, opticalLeft } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const MENU = require('../../assets/illustrations/menu.png');

function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function alarmSortKey(a: Pick<Alarm, 'hour' | 'minute'>) {
  return a.hour * 60 + a.minute;
}

export function HomeScreen({ navigation }: Props) {
  const { answers } = useOnboarding();
  const { alarms, toggleAlarm } = useAlarms();
  const { isPaused, pauseUntil } = useAppSettings();

  const greeting = greetingForHour(new Date().getHours());
  const title = answers.name ? `${greeting}, ${answers.name}` : greeting;

  const listedAlarms = useMemo(
    () => [...alarms].sort((a, b) => alarmSortKey(a) - alarmSortKey(b)),
    [alarms]
  );

  const anyEnabled = listedAlarms.some((a) => a.enabled);
  const hasAlarms = listedAlarms.length > 0;
  const allPaused = hasAlarms && !anyEnabled;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Menu"
          onPress={() => navigation.navigate('Menu')}
          style={styles.menuBtn}
        >
          <Image source={MENU} style={styles.menuIcon} resizeMode="contain" />
        </Pressable>

        <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.hello}>{title}</Text>

        {isPaused ? (
          <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.pausedGlobal}>
            Alarms paused{pauseUntil ? ` until ${formatDateKey(pauseUntil)}` : ''}.
          </Text>
        ) : null}

        <MoodCheckInCard name={answers.name} />

        <View style={[styles.block, !hasAlarms && styles.blockEmpty]}>
          {allPaused ? (
            <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.pausedBanner}>
              All alarms are off. Turn one on if you want Future You to wake
              you tomorrow.
            </Text>
          ) : null}

          {hasAlarms ? (
            listedAlarms.map((alarm, index) => (
              <View
                key={alarm.id}
                style={[styles.alarmRow, index > 0 && styles.alarmRowBorder]}
              >
                <View style={styles.alarmTop}>
                  <Pressable
                    style={styles.alarmMain}
                    onPress={() =>
                      navigation.navigate('CreateAlarm', {
                        alarmId: alarm.id,
                      })
                    }
                  >
                    <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out"
                      style={[
                        styles.alarmTime,
                        !alarm.enabled && styles.alarmDim,
                      ]}
                    >
                      {formatAlarmTime(alarm)}
                    </Text>
                    <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out"
                      style={[
                        styles.alarmDays,
                        !alarm.enabled && styles.alarmDim,
                      ]}
                    >
                      {formatAlarmDays(alarm.days)}
                    </Text>
                    {!alarm.audioUri ? (
                      <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.alarmPreparing}>
                        {alarm.voiceFailed
                          ? 'Your voice isn’t ready, so this alarm will ring with a soft tone. Tap to try again.'
                          : 'Preparing your voice…'}
                      </Text>
                    ) : null}
                  </Pressable>
                  <Switch
                    value={alarm.enabled}
                    onValueChange={() => toggleAlarm(alarm.id)}
                    trackColor={{ false: colors.border, true: colors.text }}
                  />
                </View>
              </View>
            ))
          ) : (
            <View style={styles.alarmRow}>
              <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.emptyTitle}>
                Set your first wake
              </Text>
              <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.emptyAlarms}>
                Future You will call you by name tomorrow morning.
              </Text>
            </View>
          )}
          <View style={styles.alarmActions}>
            <TextArrowButton
              label={hasAlarms ? 'add alarm' : 'set wake time'}
              wide
              color={accents.goldDeep}
              onPress={() => navigation.navigate('CreateAlarm')}
            />
          </View>
        </View>
      </ScrollView>

      {/*
        One permission card at a time. On iOS the wake runs through AlarmKit,
        so "Allow alarms" is the only ask; notification alerts are just the
        fallback and only matter where AlarmKit does not exist.
      */}
      {Platform.OS === 'ios' ? (
        <AlarmPermissionNudge placement="bottom" />
      ) : (
        <NotificationPermissionNudge placement="bottom" />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    paddingHorizontal: spacing.inset,
    paddingTop: spacing.webTop + spacing.screenTop,
    paddingBottom: 48,
  },
  menuBtn: {
    width: 40,
    height: 40,
    marginBottom: 8,
    justifyContent: 'center',
  },
  menuIcon: {
    width: 28,
    height: 28,
  },
  hello: {
    fontFamily: fonts.headingRegular,
    fontSize: 40,
    ...opticalLeft(40),
    lineHeight: 44,
    color: colors.text,
    marginBottom: 24,
    ...noFakeBold,
    ...headingClipFix,
  },
  pausedGlobal: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
    marginBottom: 24,
  },
  block: {
    borderRadius: 24,
    backgroundColor: colors.chip,
    padding: spacing.lg,
    marginBottom: 24,
    overflow: 'hidden',
  },
  pausedBanner: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
    marginBottom: 16,
  },
  /** No alarm yet: the block becomes the screen's hero. */
  blockEmpty: {
    borderWidth: 0,
    backgroundColor: accents.gold,
    padding: 24,
  },
  emptyTitle: {
    fontFamily: fonts.headingRegular,
    fontSize: 28,
    lineHeight: 32,
    color: colors.text,
    marginBottom: 8,
    ...noFakeBold,
  },
  emptyAlarms: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
  },
  emptyCta: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  alarmRow: {
    paddingVertical: 8,
  },
  alarmMain: {
    flex: 1,
    minWidth: 0,
  },
  /** Time + on/off on one horizontal line. */
  alarmTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    minHeight: 56,
  },
  alarmRowBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(26, 26, 26, 0.12)',
    marginTop: 4,
    paddingTop: 16,
  },
  alarmPreparing: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  alarmActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    gap: 16,
  },
  alarmTime: {
    fontFamily: fonts.headingRegular,
    fontSize: 48,
    ...opticalLeft(48),
    lineHeight: 56,
    color: colors.text,
    // Proportional figures: tabular ones pad "1" and push 11:00 right.
    flexShrink: 0,
    ...noFakeBold,
    ...headingClipFix,
  },
  alarmDays: {
    fontFamily: fonts.headingRegular,
    fontSize: 17,
    color: colors.text,
    marginTop: 4,
    ...noFakeBold,
  },
  alarmDim: {
    opacity: 0.38,
  },
});
