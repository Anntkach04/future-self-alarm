import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChipQuestionScreen } from '../components/ChipQuestionScreen';
import { useOnboarding } from '../context/OnboardingContext';
import { FUTURE_SELF_OPTIONS } from '../data/onboardingOptions';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'FutureSelf'>;

export function FutureSelfScreen({ navigation }: Props) {
  const { answers, toggleFutureSelf, addFutureSelf } = useOnboarding();

  return (
    <ChipQuestionScreen
      question={"Why do you want\nto wake up early?"}
      subtitle="Or pick from the chips below."
      options={FUTURE_SELF_OPTIONS}
      selected={answers.futureSelf}
      onToggle={toggleFutureSelf}
      onAddCustom={addFutureSelf}
      addPlaceholder="Write your own reason…"
      inputAlwaysVisible
      onSubmit={() => navigation.navigate('AlreadyYou')}
    />
  );
}
