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
      question={"What gets you\nout of bed?"}
      subtitle="Future you will remind you of it."
      options={HARD_MORNING_OPTIONS}
      selected={answers.hardMornings}
      onToggle={toggleHardMorning}
      onAddCustom={addHardMorning}
      addPlaceholder="Your own words"
      onSubmit={() => navigation.navigate('WakeStruggle')}
    />
  );
}
