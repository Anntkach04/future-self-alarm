import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChipQuestionScreen } from '../components/ChipQuestionScreen';
import { useOnboarding } from '../context/OnboardingContext';
import { VOICE_STYLE_OPTIONS } from '../data/onboardingOptions';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'VoiceStyle'>;

export function VoiceStyleScreen({ navigation }: Props) {
  const { answers, setVoiceStyle, voice } = useOnboarding();
  // Came back here after the voice was already cloned: go forward to the
  // voice you have, not to a new recording (people had to re-record after
  // tapping back). "re-record" on the next screen still records again.
  const hasVoice = Boolean(voice.voiceId) && !voice.isDemo;

  return (
    <ChipQuestionScreen
      question={"How should future\nyou sound?"}
      subtitle="Pick one tone for your mornings."
      options={VOICE_STYLE_OPTIONS}
      selected={answers.voiceStyle ? [answers.voiceStyle] : []}
      onToggle={setVoiceStyle}
      allowAdd={false}
      onSubmit={() => navigation.navigate(hasVoice ? 'VoicePreview' : 'VoiceRecord')}
    />
  );
}
