import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BackButton } from '../components/BackButton';
import { MoodWhySheet } from '../components/MoodWhySheet';
import { Screen } from '../components/Screen';
import { useMoodCheckIn } from '../context/MoodCheckInContext';
import { useOnboarding } from '../context/OnboardingContext';
import { MORE_MOODS, type Mood } from '../data/moods';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, noFakeBold } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'MoodMore'>;

export function MoodMoreScreen({}: Props) {
  const { answers } = useOnboarding();
  const { today, saveCheckIn } = useMoodCheckIn();
  const [sheetMood, setSheetMood] = useState<Mood | null>(null);

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <BackButton style={styles.back} />
        <Text style={styles.title}>How are you feeling today?</Text>
        <View style={styles.grid}>
          {MORE_MOODS.map((mood) => {
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
                <Text style={styles.label}>{mood.label}</Text>
              </Pressable>
            );
          })}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: 40,
  },
  back: {
    marginTop: 0,
  },
  title: {
    fontFamily: fonts.headingRegular,
    fontSize: 36,
    lineHeight: 40,
    color: colors.text,
    marginBottom: 24,
    ...noFakeBold,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  mood: {
    width: '47%',
    minHeight: 88,
    borderRadius: 20,
    padding: 12,
    justifyContent: 'flex-end',
  },
  moodSelected: {
    borderWidth: 2,
    borderColor: colors.text,
  },
  label: {
    fontFamily: fonts.headingRegular,
    fontSize: 20,
    color: colors.text,
    ...noFakeBold,
  },
});
