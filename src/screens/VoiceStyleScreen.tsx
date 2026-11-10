import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChipQuestionScreen } from '../components/ChipQuestionScreen';
import { useOnboarding } from '../context/OnboardingContext';
import { VOICE_STYLE_OPTIONS } from '../data/onboardingOptions';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'VoiceStyle'>;

export function VoiceStyleScreen({ navigation }: Props) {
  const { answers, setVoiceStyle } = useOnboarding();

  return (
    <ChipQuestionScreen
      question={"How should future\nyou sound?"}
      subtitle="Pick one tone for your mornings."
      options={VOICE_STYLE_OPTIONS}
      selected={answers.voiceStyle ? [answers.voiceStyle] : []}
      onToggle={setVoiceStyle}
      allowAdd={false}
      onSubmit={() => navigation.navigate('VoiceRecord')}
    />
  );
}
