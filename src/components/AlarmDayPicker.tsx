import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  DAY_LABELS,
  EVERY_DAY,
  WEEKDAYS,
  WEEKENDS,
} from '../context/AlarmsContext';
import { colors, fonts, noFakeBold, radii } from '../theme';
import { uiLabel } from '../utils/labels';

type Props = {
  days: number[];
  onChange: (days: number[]) => void;
};

/** Two letters so Tue/Thu and Sat/Sun are told apart; full names for VoiceOver. */
const DAY_SHORT = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'] as const;
const DAY_FULL = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

function sortedUnique(days: number[]) {
  return [...new Set(days)].sort((a, b) => a - b);
}

function sameDays(a: number[], b: number[]) {
  return sortedUnique(a).join() === sortedUnique(b).join();
}

export function AlarmDayPicker({ days, onChange }: Props) {
  const toggleDay = (day: number) => {
    onChange(
      days.includes(day)
        ? days.filter((d) => d !== day)
        : sortedUnique([...days, day])
    );
  };

  return (
    <View style={styles.wrap}>
      <Text maxFontSizeMultiplier={1.2} lineBreakStrategyIOS="push-out" style={styles.section}>Repeat</Text>
      <View style={styles.presets}>
        {[
          { label: 'weekdays', value: WEEKDAYS },
          { label: 'weekends', value: WEEKENDS },
          { label: 'every day', value: EVERY_DAY },
        ].map((item) => {
          const active = sameDays(days, item.value);
          return (
            <Pressable
              key={item.label}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onChange([...item.value])}
              style={[styles.preset, active && styles.presetOn]}
            >
              <Text maxFontSizeMultiplier={1.5} lineBreakStrategyIOS="push-out" style={[styles.presetText, active && styles.presetTextOn]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.days}>
        {DAY_LABELS.map((label, index) => {
          const on = days.includes(index);
          return (
            <Pressable
              key={`${label}-${index}`}
              accessibilityRole="checkbox"
              accessibilityLabel={DAY_FULL[index]}
              accessibilityState={{ checked: on }}
              onPress={() => toggleDay(index)}
              style={[styles.day, on && styles.dayOn]}
            >
              <Text maxFontSizeMultiplier={1.3} lineBreakStrategyIOS="push-out" style={[styles.dayText, on && styles.dayTextOn]}>
                {DAY_SHORT[index]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  section: {
    fontFamily: fonts.headingRegular,
    fontSize: 22,
    color: colors.text,
    marginBottom: 16,
    ...noFakeBold,
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  preset: {
    borderWidth: 1,
    borderColor: colors.text,
    borderRadius: radii.chip,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  presetOn: {
    backgroundColor: colors.text,
  },
  presetText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
  },
  presetTextOn: {
    color: colors.bg,
  },
  days: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  day: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  dayOn: {
    backgroundColor: colors.text,
  },
  dayText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  dayTextOn: {
    color: colors.bg,
  },
});
