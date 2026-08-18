import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChipQuestionScreen } from '../components/ChipQuestionScreen';
import { useOnboarding } from '../context/OnboardingContext';
import { MORNING_FEELING_OPTIONS } from '../data/onboardingOptions';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'MorningFeeling'>;

export function MorningFeelingScreen({ navigation }: Props) {
  const { answers, toggleMorningFeeling, addMorningFeeling } = useOnboarding();

  return (
    <ChipQuestionScreen
      question={"How do you want\nto feel when you\nopen your eyes?"}
      subtitle="Choose the feeling you want to wake up into."
      options={MORNING_FEELING_OPTIONS}
      selected={answers.morningFeelings}
      onToggle={toggleMorningFeeling}
      onAddCustom={addMorningFeeling}
      addPlaceholder="Describe it in your own words..."
      onSubmit={() => navigation.navigate('FutureSelf')}
    />
  );
}
