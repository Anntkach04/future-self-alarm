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
      question={"Write 3 of your\nmain goals in life"}
      options={FUTURE_SELF_OPTIONS}
      selected={answers.futureSelf}
      onToggle={toggleFutureSelf}
      onAddCustom={addFutureSelf}
      addPlaceholder="Write a goal in your own words"
      onSubmit={() => navigation.navigate('AlreadyYou')}
    />
  );
}
