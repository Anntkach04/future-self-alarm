import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlarmPermissionNudge } from '../components/AlarmPermissionNudge';
import { MoodWhySheet } from '../components/MoodWhySheet';
import { NotificationPermissionNudge } from '../components/NotificationPermissionNudge';
import { TextArrowButton } from '../components/TextArrowButton';
import { useAppSettings } from '../context/AppSettingsContext';
import {
  formatAlarmDays,
  formatAlarmTime,
  useAlarms,
  type Alarm,
} from '../context/AlarmsContext';
import { useMoodCheckIn } from '../context/MoodCheckInContext';
import { useOnboarding } from '../context/OnboardingContext';
import { BASE_MOODS, type Mood } from '../data/moods';
import { RootStackParamList } from '../navigation/types';
import { accents, colors, fonts, headingClipFix, noFakeBold, spacing } from '../theme';
import { uiLabel } from '../utils/labels';

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
  const { today, saveCheckIn } = useMoodCheckIn();
  const { isPaused, pauseUntil } = useAppSettings();
  const [sheetMood, setSheetMood] = useState<Mood | null>(null);

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

        <Text maxFontSizeMultiplier={1.2} style={styles.hello}>{title}</Text>

        {isPaused ? (
          <Text maxFontSizeMultiplier={1.5} style={styles.pausedGlobal}>
            Alarms paused{pauseUntil ? ` until ${pauseUntil}` : ''}. Resume in
            Menu → Notifications when you’re back.
          </Text>
        ) : null}

        <Text maxFontSizeMultiplier={1.2} style={styles.feeling}>How are you feeling today?</Text>
        <Text maxFontSizeMultiplier={1.5} style={styles.moodHint}>
          This shapes tomorrow’s wake only - not every morning forever.
        </Text>
        <View style={styles.moodRow}>
          {BASE_MOODS.map((mood) => {
            const selected = today?.moodId === mood.id;
            return (
              <Pressable
                key={mood.id}
                onPress={() => setSheetMood(mood)}
                style={[
                  styles.mood,
                  { backgroundColor: mood.color },
                  selected && styles.moodSelected,
                ]}
              >
                <Text maxFontSizeMultiplier={1.2} style={styles.moodLabel}>{uiLabel(mood.label)}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.moreRow}>
          <TextArrowButton
            label="more"
            color={accents.gold}
            textColor={colors.text}
            onPress={() => navigation.navigate('MoodMore')}
          />
        </View>

        <View style={styles.block}>
          {allPaused ? (
            <Text maxFontSizeMultiplier={1.5} style={styles.pausedBanner}>
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
                    <Text maxFontSizeMultiplier={1.2}
                      style={[
                        styles.alarmTime,
                        !alarm.enabled && styles.alarmDim,
                      ]}
                    >
                      {formatAlarmTime(alarm)}
                    </Text>
                    <Text maxFontSizeMultiplier={1.2}
                      style={[
                        styles.alarmDays,
                        !alarm.enabled && styles.alarmDim,
                      ]}
                    >
                      {formatAlarmDays(alarm.days)}
                    </Text>
                    {!alarm.audioUri ? (
                      <Text maxFontSizeMultiplier={1.5} style={styles.alarmPreparing}>
                        Preparing your voice…
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
              <Text maxFontSizeMultiplier={1.5} style={styles.emptyAlarms}>
                No wake set yet. Add an alarm so Future You can call you in the
                morning.
              </Text>
            </View>
          )}
          <View style={styles.alarmActions}>
            <TextArrowButton
              label={hasAlarms ? 'add alarm' : 'set wake time'}
              color={accents.coral}
              onPress={() => navigation.navigate('CreateAlarm')}
            />
          </View>
        </View>
      </ScrollView>

      <MoodWhySheet
        visible={Boolean(sheetMood)}
        mood={sheetMood}
        name={answers.name}
        onClose={() => setSheetMood(null)}
        onSaved={({ mood, note, advice }) =>
          saveCheckIn({
            moodId: mood.id,
            moodLabel: mood.label,
            note,
            advice,
          })
        }
      />
      <NotificationPermissionNudge placement="bottom" />
      {/* AlarmKit deny nudge only on Home — not on Create Alarm. */}
      <AlarmPermissionNudge placement="bottom" />
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
    paddingTop: spacing.md + spacing.webTop,
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
    fontSize: 36,
    lineHeight: 44,
    color: colors.text,
    marginBottom: 20,
    ...noFakeBold,
    ...headingClipFix,
  },
  pausedGlobal: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    marginBottom: 20,
  },
  feeling: {
    fontFamily: fonts.headingRegular,
    fontSize: 24,
    lineHeight: 30,
    color: colors.text,
    marginTop: 4,
    marginBottom: 6,
    ...noFakeBold,
    ...headingClipFix,
  },
  moodHint: {
    fontFamily: fonts.bodyLight,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    marginBottom: 14,
  },
  moodRow: {
    flexDirection: 'row',
    gap: 8,
  },
  mood: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 18,
    padding: 8,
    justifyContent: 'flex-end',
    overflow: 'visible',
  },
  moodSelected: {
    borderWidth: 2,
    borderColor: colors.text,
  },
  moodLabel: {
    fontFamily: fonts.headingRegular,
    fontSize: 16,
    lineHeight: 20,
    color: colors.text,
    ...noFakeBold,
  },
  moreRow: {
    alignItems: 'flex-end',
    marginTop: 12,
    marginBottom: 28,
  },
  block: {
    borderWidth: 1.5,
    borderColor: colors.text,
    borderRadius: 24,
    backgroundColor: 'transparent',
    padding: 18,
    marginBottom: 20,
    overflow: 'hidden',
  },
  pausedBanner: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    marginBottom: 14,
  },
  emptyAlarms: {
    fontFamily: fonts.bodyLight,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
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
    gap: 12,
    minHeight: 56,
  },
  alarmRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.text,
    marginTop: 4,
    paddingTop: 12,
  },
  alarmPreparing: {
    fontFamily: fonts.bodyLight,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  alarmActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
  },
  alarmTime: {
    fontFamily: fonts.headingRegular,
    fontSize: 48,
    lineHeight: 56,
    color: colors.text,
    fontVariant: ['tabular-nums'],
    flexShrink: 0,
    ...noFakeBold,
    ...headingClipFix,
  },
  alarmDays: {
    fontFamily: fonts.headingRegular,
    fontSize: 18,
    color: colors.text,
    marginTop: 4,
    ...noFakeBold,
  },
  alarmDim: {
    opacity: 0.38,
  },
});
