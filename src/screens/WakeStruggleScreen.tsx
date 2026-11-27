import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChipQuestionScreen } from '../components/ChipQuestionScreen';
import { useOnboarding } from '../context/OnboardingContext';
import { WAKE_STRUGGLE_OPTIONS } from '../data/onboardingOptions';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'WakeStruggle'>;

/**
 * "What usually happens after your alarm?" One answer. Part of onboarding;
 * people who onboarded before it existed reach it once from Home.
 */
export function WakeStruggleScreen({ navigation }: Props) {
  const { answers, onboardingComplete, setWakeStruggle } = useOnboarding();
  const selected = WAKE_STRUGGLE_OPTIONS.filter((o) => o.value === answers.wakeStruggle).map(
    (o) => o.label
  );

  return (
    <ChipQuestionScreen
      question={'What usually happens\nafter your alarm?'}
      subtitle="So future you knows how to wake you."
      options={WAKE_STRUGGLE_OPTIONS}
      selected={selected}
      allowAdd={false}
      onToggle={(label) => {
        const option = WAKE_STRUGGLE_OPTIONS.find((o) => o.label === label);
        if (option) setWakeStruggle(option.value);
      }}
      onSubmit={() => {
        if (onboardingComplete) navigation.goBack();
        else navigation.navigate('VoiceStyle');
      }}
    />
  );
}
