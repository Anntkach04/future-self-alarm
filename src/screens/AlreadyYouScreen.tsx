import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChipQuestionScreen } from '../components/ChipQuestionScreen';
import { useOnboarding } from '../context/OnboardingContext';
import { ALREADY_YOU_OPTIONS } from '../data/onboardingOptions';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AlreadyYou'>;

export function AlreadyYouScreen({ navigation }: Props) {
  const { answers, toggleAlreadyProud, addAlreadyProud } = useOnboarding();

  return (
    <ChipQuestionScreen
      question={"What is Future You\nalready proud of?"}
      subtitle="Choose what is already true about you — even if you're still growing into it."
      options={ALREADY_YOU_OPTIONS}
      selected={answers.alreadyProud}
      onToggle={toggleAlreadyProud}
      onAddCustom={addAlreadyProud}
      addPlaceholder="What are you already proud of?"
      onSubmit={() => navigation.navigate('HardMornings')}
    />
  );
}
