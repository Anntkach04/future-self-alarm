import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlarmPermissionNudge } from '../components/AlarmPermissionNudge';
import { GoalCheckCard } from '../components/GoalCheckCard';
import { WakeStruggleCard } from '../components/WakeStruggleCard';
import { TomorrowCard } from '../components/TomorrowCard';
import { MoodCheckInCard } from '../components/MoodCheckInCard';
import { NotificationPermissionNudge } from '../components/NotificationPermissionNudge';
import { TextArrowButton } from '../components/TextArrowButton';
import { BETA_FREE_ACCESS, BETA_LABEL } from '../config/beta';
import { useAppSettings } from '../context/AppSettingsContext';
import {
  formatAlarmDays,
  formatAlarmTime,
  useAlarms,
  type Alarm,
} from '../context/AlarmsContext';
import { useOnboarding } from '../context/OnboardingContext';
import { RootStackParamList } from '../navigation/types';
import {
  accents,
  colors,
  earth,
  fonts,
  headingClipFix,
  noFakeBold,
  opticalLeft,
  radii,
  spacing,
  typeScale,
} from '../theme';

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
        {BETA_FREE_ACCESS ? (
          <View style={styles.betaPill} accessibilityLabel="Beta version">
            <Text maxFontSizeMultiplier={1.2} style={styles.betaText}>
              {BETA_LABEL}
            </Text>
          </View>
        ) : null}

        <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.hello}>{title}</Text>

        <MoodCheckInCard name={answers.name} />

        <TomorrowCard />

        <GoalCheckCard />

        <WakeStruggleCard />

        <View style={[styles.block, !hasAlarms && styles.blockEmpty]}>
          {allPaused ? (
            <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={styles.pausedBanner}>
              All alarms are off. Turn one on if you want future you to wake
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
                Future you will call you by name tomorrow morning.
              </Text>
            </View>
          )}
          {hasAlarms ? null : (
            <View style={styles.alarmActions}>
              <TextArrowButton
                label="set wake time"
                wide
                color={accents.gold}
                onPress={() => navigation.navigate('CreateAlarm')}
              />
            </View>
          )}
        </View>
        {hasAlarms ? (
          <TextArrowButton
            label="add alarm"
            color={accents.gold}
            onPress={() => navigation.navigate('CreateAlarm')}
            style={styles.addAlarm}
          />
        ) : null}
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
    paddingBottom: spacing.xxl,
  },
  menuBtn: {
    width: 40,
    height: 40,
    marginBottom: spacing.xs,
    justifyContent: 'center',
  },
  menuIcon: {
    width: 28,
    height: 28,
  },
  /** Free-beta marker, top right, same row as the menu button. */
  betaPill: {
    position: 'absolute',
    top: spacing.webTop + spacing.screenTop + 8,
    right: spacing.inset,
    backgroundColor: accents.lilac,
    borderRadius: radii.chip,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  betaText: {
    fontFamily: fonts.bodyMedium,
    ...typeScale.footnote,
    color: colors.text,
    ...noFakeBold,
  },
  hello: {
    fontFamily: fonts.headingRegular,
    ...typeScale.title1,
    ...opticalLeft(40),
    color: colors.text,
    marginBottom: spacing.lg,
    ...noFakeBold,
    ...headingClipFix,
  },
  block: {
    borderRadius: radii.card,
    borderCurve: 'continuous',
    backgroundColor: earth.blue,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    overflow: 'hidden',
  },
  pausedBanner: {
    fontFamily: fonts.body,
    ...typeScale.subhead,
    color: colors.text,
    marginBottom: spacing.md,
  },
  /** No alarm yet: the block becomes the screen's hero. */
  blockEmpty: {
    padding: spacing.lg,
  },
  emptyTitle: {
    fontFamily: fonts.headingRegular,
    ...typeScale.title2,
    color: colors.text,
    marginBottom: spacing.xs,
    ...noFakeBold,
  },
  emptyAlarms: {
    fontFamily: fonts.body,
    ...typeScale.subhead,
    color: colors.textMuted,
  },
  alarmRow: {
    paddingVertical: spacing.xs,
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
    gap: spacing.md,
    minHeight: 56,
  },
  alarmRowBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(26, 26, 26, 0.12)',
    marginTop: spacing.xs,
    paddingTop: spacing.md,
  },
  alarmPreparing: {
    fontFamily: fonts.body,
    ...typeScale.footnote,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  alarmActions: {
    marginTop: spacing.lg,
  },
  addAlarm: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
  },
  alarmTime: {
    fontFamily: fonts.headingRegular,
    ...typeScale.display,
    ...opticalLeft(48),
    color: colors.text,
    // Proportional figures: tabular ones pad "1" and push 11:00 right.
    flexShrink: 0,
    ...noFakeBold,
    ...headingClipFix,
  },
  /** Details in the body face: the serif belongs to the time alone. */
  alarmDays: {
    fontFamily: fonts.body,
    ...typeScale.subhead,
    color: colors.textMuted,
  },
  alarmDim: {
    opacity: 0.38,
  },
});
