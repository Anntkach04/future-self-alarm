import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  DAY_LABELS,
  EVERY_DAY,
  WEEKDAYS,
  WEEKENDS,
} from '../context/AlarmsContext';
import { colors, fonts, noFakeBold, noFakeLight, radii } from '../theme';
import { uiLabel } from '../utils/labels';

type Props = {
  days: number[];
  onChange: (days: number[]) => void;
};

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
      <Text style={styles.section}>{uiLabel('Repeat')}</Text>
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
              onPress={() => onChange([...item.value])}
              style={[styles.preset, active && styles.presetOn]}
            >
              <Text style={[styles.presetText, active && styles.presetTextOn]}>
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
              onPress={() => toggleDay(index)}
              style={[styles.day, on && styles.dayOn]}
            >
              <Text style={[styles.dayText, on && styles.dayTextOn]}>
                {label.toLowerCase()}
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
    borderWidth: 1.5,
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
    fontFamily: fonts.bodyLight,
    fontSize: 15,
    color: colors.text,
    ...noFakeLight,
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
    borderWidth: 1.5,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  dayOn: {
    backgroundColor: colors.text,
  },
  dayText: {
    fontFamily: fonts.bodyLight,
    fontSize: 14,
    color: colors.text,
    ...noFakeLight,
  },
  dayTextOn: {
    color: colors.bg,
  },
});
