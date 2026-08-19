import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChipQuestionScreen } from '../components/ChipQuestionScreen';
import { useOnboarding } from '../context/OnboardingContext';
import { MESSAGE_LENGTH_OPTIONS } from '../data/onboardingOptions';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'MessageLength'>;

export function MessageLengthScreen({ navigation }: Props) {
  const { answers, setMessageLength } = useOnboarding();

  return (
    <ChipQuestionScreen
      question={"How much do you\nwant to hear?"}
      subtitle="You can always change this later."
      options={MESSAGE_LENGTH_OPTIONS}
      selected={answers.messageLength ? [answers.messageLength] : []}
      onToggle={setMessageLength}
      allowAdd={false}
      onSubmit={() => navigation.navigate('WakeUpTime')}
    />
  );
}
