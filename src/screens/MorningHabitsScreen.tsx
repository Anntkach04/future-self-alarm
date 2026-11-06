import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChipQuestionScreen } from '../components/ChipQuestionScreen';
import { useOnboarding } from '../context/OnboardingContext';
import { MORNING_HABIT_OPTIONS } from '../data/onboardingOptions';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'MorningHabits'>;

export function MorningHabitsScreen({ navigation }: Props) {
  const { answers, toggleMorningHabit, addMorningHabit } = useOnboarding();

  return (
    <ChipQuestionScreen
      question={"What do you want\nto do in the morning?"}
      subtitle="We’ll remind you of the habits you chose."
      options={MORNING_HABIT_OPTIONS}
      selected={answers.morningHabits}
      onToggle={toggleMorningHabit}
      onAddCustom={addMorningHabit}
      addPlaceholder="Your morning habit"
      onSubmit={() => navigation.navigate('VoiceRecord')}
    />
  );
}
