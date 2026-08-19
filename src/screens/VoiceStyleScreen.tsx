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
      question={"What tone should\nmornings have?"}
      subtitle="This shapes how Future You speaks - pick once."
      options={VOICE_STYLE_OPTIONS}
      selected={answers.voiceStyle ? [answers.voiceStyle] : []}
      onToggle={setVoiceStyle}
      allowAdd={false}
      onSubmit={() => navigation.navigate('WakeUpTime')}
    />
  );
}
