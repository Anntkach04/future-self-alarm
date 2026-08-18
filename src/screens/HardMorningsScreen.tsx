import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChipQuestionScreen } from '../components/ChipQuestionScreen';
import { useOnboarding } from '../context/OnboardingContext';
import { HARD_MORNING_OPTIONS } from '../data/onboardingOptions';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'HardMornings'>;

export function HardMorningsScreen({ navigation }: Props) {
  const { answers, toggleHardMorning, addHardMorning } = useOnboarding();

  return (
    <ChipQuestionScreen
      question={"What do you need\nto hear on hard\nmornings?"}
      subtitle="Choose the words that would actually help you get out of bed."
      helperText="We'll weave this into your mornings."
      options={HARD_MORNING_OPTIONS}
      selected={answers.hardMornings}
      onToggle={toggleHardMorning}
      onAddCustom={addHardMorning}
      addPlaceholder="Write your personal morning mantra..."
      onSubmit={() => navigation.navigate('VoiceStyle')}
    />
  );
}
