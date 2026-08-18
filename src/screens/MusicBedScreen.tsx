import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChipQuestionScreen } from '../components/ChipQuestionScreen';
import { useStopMusicBedOnLeave } from '../hooks/useStopMusicBedOnLeave';
import { useOnboarding } from '../context/OnboardingContext';
import { MUSIC_BED_OPTIONS } from '../data/onboardingOptions';
import { RootStackParamList } from '../navigation/types';
import {
  stopMusicBedPreview,
  toggleMusicBedPreview,
} from '../services/musicBedPreview';

type Props = NativeStackScreenProps<RootStackParamList, 'MusicBed'>;

export function MusicBedScreen({ navigation }: Props) {
  const { answers, setMusicBedId } = useOnboarding();
  const selectedLabel =
    MUSIC_BED_OPTIONS.find((item) => item.id === answers.musicBedId)?.label ??
    null;

  useStopMusicBedOnLeave();

  return (
    <ChipQuestionScreen
      question={"What music sits\nunder your voice?"}
      subtitle="Tap a bed for a short preview — up to 30 seconds."
      options={MUSIC_BED_OPTIONS}
      selected={selectedLabel ? [selectedLabel] : []}
      onToggle={(label) => {
        const match = MUSIC_BED_OPTIONS.find((item) => item.label === label);
        if (match?.id) {
          setMusicBedId(match.id);
          void toggleMusicBedPreview(match.id).catch(() => undefined);
        }
      }}
      allowAdd={false}
      onSubmit={() => {
        void stopMusicBedPreview();
        navigation.navigate('WakeUpTime');
      }}
    />
  );
}
