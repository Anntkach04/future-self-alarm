import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MoodWhySheet } from '../components/MoodWhySheet';
import { RecapPills } from '../components/RecapPills';
import { TextArrowButton } from '../components/TextArrowButton';
import {
  formatAlarmDays,
  formatAlarmTime,
  useAlarms,
  type Alarm,
} from '../context/AlarmsContext';
import { useMoodCheckIn } from '../context/MoodCheckInContext';
import { useOnboarding } from '../context/OnboardingContext';
import {
  ALREADY_YOU_OPTIONS,
  FUTURE_SELF_OPTIONS,
  HARD_MORNING_OPTIONS,
  MESSAGE_LENGTH_OPTIONS,
  VOICE_STYLE_OPTIONS,
} from '../data/onboardingOptions';
import { BASE_MOODS, type Mood } from '../data/moods';
import { RootStackParamList } from '../navigation/types';
import { accents, colors, fonts, noFakeBold, spacing } from '../theme';
import { colorsForRecapSections } from '../utils/optionColors';
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
  const { alarms } = useAlarms();
  const { today, saveCheckIn } = useMoodCheckIn();
  const [sheetMood, setSheetMood] = useState<Mood | null>(null);

  const greeting = greetingForHour(new Date().getHours());
  const title = answers.name ? `${greeting}, ${answers.name}` : greeting;

  const listedAlarms = useMemo(
    () =>
      [...alarms]
        .filter((alarm) => alarm.enabled)
        .sort((a, b) => alarmSortKey(a) - alarmSortKey(b)),
    [alarms]
  );

  const [
    goalsColors,
    proudColors,
    hardMorningColors,
    voiceColors,
    messageColors,
  ] = useMemo(
    () =>
      colorsForRecapSections([
        { items: answers.futureSelf, options: FUTURE_SELF_OPTIONS },
        { items: answers.alreadyProud, options: ALREADY_YOU_OPTIONS },
        { items: answers.hardMornings, options: HARD_MORNING_OPTIONS },
        {
          items: answers.voiceStyle ? [answers.voiceStyle] : [],
          options: VOICE_STYLE_OPTIONS,
        },
        {
          items: answers.messageLength ? [answers.messageLength] : [],
          options: MESSAGE_LENGTH_OPTIONS,
        },
      ]),
    [
      answers.futureSelf,
      answers.alreadyProud,
      answers.hardMornings,
      answers.voiceStyle,
      answers.messageLength,
    ]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
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

        <Text style={styles.feeling}>How are you feeling today?</Text>
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
          {listedAlarms.length ? (
            listedAlarms.map((alarm, index) => (
              <Pressable
                key={alarm.id}
                onPress={() =>
                  navigation.navigate('CreateAlarm', { alarmId: alarm.id })
                }
                style={[
                  styles.alarmRow,
                  index > 0 && styles.alarmRowBorder,
                ]}
              >
                <View>
                  <Text style={styles.alarmTime}>
                    {formatAlarmTime(alarm)}
                  </Text>
                  <Text style={styles.alarmDays}>
                    {formatAlarmDays(alarm.days)}
                  </Text>
                </View>
              </Pressable>
            ))
          ) : (
            <View style={styles.alarmRow}>
              <View>
                <Text style={styles.alarmTime}>
                  {formatAlarmTime({
                    hour: answers.wakeHour,
                    minute: answers.wakeMinute,
                  })}
                </Text>
                <Text style={styles.alarmDays}>
                  {answers.wakeDays.length
                    ? formatAlarmDays(answers.wakeDays)
                    : uiLabel('set the days')}
                </Text>
              </View>
            </View>
          )}
          <View style={styles.alarmActions}>
            <TextArrowButton
              label="add alarm"
              color={accents.coral}
              onPress={() => navigation.navigate('CreateAlarm')}
            />
            {listedAlarms.length ? (
              <TextArrowButton
                label="set up alarm"
                color={accents.lime}
                onPress={() =>
                  navigation.navigate('CreateAlarm', {
                    alarmId: listedAlarms[0]?.id,
                  })
                }
              />
            ) : null}
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.recapTitle}>{uiLabel('goals')}</Text>
          <RecapPills items={answers.futureSelf} colors={goalsColors} />
          <Text style={styles.recapTitle}>{uiLabel('already proud')}</Text>
          <RecapPills items={answers.alreadyProud} colors={proudColors} />
          <Text style={styles.recapTitle}>{uiLabel('hard mornings')}</Text>
          <RecapPills items={answers.hardMornings} colors={hardMorningColors} />
          <Text style={styles.recapTitle}>{uiLabel('voice tone')}</Text>
          <RecapPills
            items={answers.voiceStyle ? [answers.voiceStyle] : []}
            colors={answers.voiceStyle ? voiceColors : undefined}
          />
          <Text style={styles.recapTitle}>{uiLabel('message length')}</Text>
          <RecapPills
            items={answers.messageLength ? [answers.messageLength] : []}
            colors={answers.messageLength ? messageColors : undefined}
          />
          <View style={styles.editRow}>
            <TextArrowButton
              label="edit profile"
              color={accents.lime}
              onPress={() => navigation.navigate('EditProfile')}
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
    paddingTop: spacing.md,
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
    lineHeight: 44,
    color: colors.text,
    marginBottom: 32,
    ...noFakeBold,
  },
  feeling: {
    fontFamily: fonts.headingRegular,
    fontSize: 26,
    lineHeight: 30,
    color: colors.text,
    marginBottom: 16,
    ...noFakeBold,
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
  },
  moodSelected: {
    borderWidth: 2,
    borderColor: colors.text,
  },
  moodLabel: {
    fontFamily: fonts.headingRegular,
    fontSize: 17,
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
  alarmRow: {
    paddingVertical: 8,
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
  recapTitle: {
    fontFamily: fonts.headingRegular,
    fontSize: 20,
    color: colors.text,
    marginTop: 8,
    marginBottom: 8,
    ...noFakeBold,
  },
  editRow: {
    alignItems: 'flex-end',
    marginTop: 16,
  },
});
