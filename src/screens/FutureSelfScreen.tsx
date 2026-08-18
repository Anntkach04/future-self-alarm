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
      question={"Who are you\nbecoming?"}
      subtitle="Choose the version of you that already feels like your Future Self."
      helperText="Write it as who you are, not what you want."
      options={FUTURE_SELF_OPTIONS}
      selected={answers.futureSelf}
      onToggle={toggleFutureSelf}
      onAddCustom={addFutureSelf}
      addPlaceholder="Who is your Future Self?"
      onSubmit={() => navigation.navigate('AlreadyYou')}
    />
  );
}
