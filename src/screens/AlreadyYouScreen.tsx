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
      question={"3 things you're\nalready proud of"}
      options={ALREADY_YOU_OPTIONS}
      selected={answers.alreadyProud}
      onToggle={toggleAlreadyProud}
      onAddCustom={addAlreadyProud}
      addPlaceholder="Something you already are"
      onSubmit={() => navigation.navigate('HardMornings')}
    />
  );
}
