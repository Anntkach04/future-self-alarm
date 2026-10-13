import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MoodWhySheet } from '../components/MoodWhySheet';
import { SwipeDeleteRow } from '../components/SwipeDeleteRow';
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
import { playAlarmAudio } from '../services/alarmScheduler';
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
  const { alarms, removeAlarm, toggleAlarm } = useAlarms();
  const { today, saveCheckIn } = useMoodCheckIn();
  const { morningsKept, isPaused, pauseUntil } = useAppSettings();
  const [sheetMood, setSheetMood] = useState<Mood | null>(null);

  const greeting = greetingForHour(new Date().getHours());
  const title = answers.name ? `${greeting}, ${answers.name}` : greeting;
  const shareLine =
    alarms.find((a) => a.enabled && a.scriptText)?.scriptText ||
    alarms.find((a) => a.scriptText)?.scriptText ||
    null;

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

        <Text style={styles.hello}>{title}</Text>
        {morningsKept > 0 ? (
          <Text style={styles.streak}>
            {morningsKept} morning{morningsKept === 1 ? '' : 's'} kept
          </Text>
        ) : null}

        {isPaused ? (
          <Text style={styles.pausedGlobal}>
            Alarms paused{pauseUntil ? ` until ${pauseUntil}` : ''}. Resume in
            Menu → Notifications when you’re back.
          </Text>
        ) : null}

        <Text style={styles.feeling}>How are you feeling today?</Text>
        <Text style={styles.moodHint}>
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
                <Text style={styles.moodLabel}>{uiLabel(mood.label)}</Text>
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
            <Text style={styles.pausedBanner}>
              All alarms are off. Turn one on if you want Future You to wake
              you tomorrow.
            </Text>
          ) : null}

          {hasAlarms ? (
            listedAlarms.map((alarm, index) => (
              <SwipeDeleteRow
                key={alarm.id}
                onDelete={() => removeAlarm(alarm.id)}
              >
                <View
                  style={[
                    styles.alarmRow,
                    index > 0 && styles.alarmRowBorder,
                  ]}
                >
                  <Pressable
                    style={styles.alarmMain}
                    onPress={() =>
                      navigation.navigate('CreateAlarm', {
                        alarmId: alarm.id,
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.alarmTime,
                        !alarm.enabled && styles.alarmDim,
                      ]}
                    >
                      {formatAlarmTime(alarm)}
                    </Text>
                    <Text
                      style={[
                        styles.alarmDays,
                        !alarm.enabled && styles.alarmDim,
                      ]}
                    >
                      {formatAlarmDays(alarm.days)}
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
          ) : (
            <View style={styles.alarmRow}>
              <Text style={styles.emptyAlarms}>
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
            {listedAlarms[0]?.audioUri ? (
              <TextArrowButton
                label="test in 10s"
                color={accents.lime}
                onPress={() => {
                  const uri = listedAlarms.find((a) => a.audioUri)?.audioUri;
                  if (!uri) return;
                  setTimeout(() => {
                    void playAlarmAudio(uri);
                  }, 10_000);
                }}
              />
            ) : null}
          </View>
          {shareLine ? (
            <View style={styles.shareRow}>
              <TextArrowButton
                label="share morning line"
                color={accents.gold}
                onPress={() => {
                  void Share.share({ message: shareLine });
                }}
              />
            </View>
          ) : null}
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
    marginBottom: 8,
    ...noFakeBold,
    ...headingClipFix,
  },
  streak: {
    fontFamily: fonts.bodyLight,
    fontSize: 15,
    color: colors.textMuted,
    marginBottom: 12,
  },
  pausedGlobal: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    marginBottom: 20,
  },
  shareRow: {
    marginTop: 12,
    alignItems: 'flex-start',
  },
  feeling: {
    fontFamily: fonts.headingRegular,
    fontSize: 24,
    lineHeight: 30,
    color: colors.text,
    marginTop: 16,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  alarmMain: {
    flex: 1,
  },
  alarmRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.text,
    marginTop: 4,
    paddingTop: 12,
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
    lineHeight: 52,
    color: colors.text,
    fontVariant: ['tabular-nums'],
    ...noFakeBold,
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
