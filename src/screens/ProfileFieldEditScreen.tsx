import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChipQuestionScreen } from '../components/ChipQuestionScreen';
import { useStopMusicBedOnLeave } from '../hooks/useStopMusicBedOnLeave';
import { useOnboarding } from '../context/OnboardingContext';
import {
  ALREADY_YOU_OPTIONS,
  FUTURE_SELF_OPTIONS,
  HARD_MORNING_OPTIONS,
  MESSAGE_LENGTH_OPTIONS,
  MUSIC_BED_OPTIONS,
  VOICE_STYLE_OPTIONS,
} from '../data/onboardingOptions';
import { ProfileFieldKey, RootStackParamList } from '../navigation/types';
import {
  stopMusicBedPreview,
  toggleMusicBedPreview,
} from '../services/musicBedPreview';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileFieldEdit'>;

type FieldConfig = {
  question: string;
  subtitle?: string;
  helperText?: string;
  options: typeof FUTURE_SELF_OPTIONS;
  getSelected: (answers: ReturnType<typeof useOnboarding>['answers']) => string[];
  onToggle: (
    ctx: ReturnType<typeof useOnboarding>,
    value: string
  ) => void;
  onAddCustom?: (
    ctx: ReturnType<typeof useOnboarding>,
    value: string
  ) => void;
  addPlaceholder?: string;
  allowAdd?: boolean;
  previewMusic?: boolean;
};

const FIELDS: Record<ProfileFieldKey, FieldConfig> = {
  futureSelf: {
    question: 'Who are you\nbecoming?',
    subtitle: 'Choose the version of you that already feels like your Future Self.',
    helperText: 'Write it as who you are, not what you want.',
    options: FUTURE_SELF_OPTIONS,
    getSelected: (a) => a.futureSelf,
    onToggle: (ctx, value) => ctx.toggleFutureSelf(value),
    onAddCustom: (ctx, value) => ctx.addFutureSelf(value),
    addPlaceholder: 'Who is your Future Self?',
  },
  alreadyProud: {
    question: 'What are you\nalready proud of?',
    subtitle: 'Future You will remind you of this on hard mornings.',
    options: ALREADY_YOU_OPTIONS,
    getSelected: (a) => a.alreadyProud,
    onToggle: (ctx, value) => ctx.toggleAlreadyProud(value),
    onAddCustom: (ctx, value) => ctx.addAlreadyProud(value),
    addPlaceholder: 'Something you already are',
  },
  hardMornings: {
    question: 'What do hard\nmornings need?',
    subtitle: 'Pick the words Future You should whisper when it’s heavy.',
    options: HARD_MORNING_OPTIONS,
    getSelected: (a) => a.hardMornings,
    onToggle: (ctx, value) => ctx.toggleHardMorning(value),
    onAddCustom: (ctx, value) => ctx.addHardMorning(value),
    addPlaceholder: 'Your own line',
  },
  voiceStyle: {
    question: 'How should\nFuture You sound?',
    subtitle: 'This shapes the tone of every morning message.',
    options: VOICE_STYLE_OPTIONS,
    getSelected: (a) => (a.voiceStyle ? [a.voiceStyle] : []),
    onToggle: (ctx, value) => ctx.setVoiceStyle(value),
    allowAdd: false,
  },
  messageLength: {
    question: 'How long should\nthe message be?',
    subtitle: 'Short boost or a full morning letter.',
    options: MESSAGE_LENGTH_OPTIONS,
    getSelected: (a) => (a.messageLength ? [a.messageLength] : []),
    onToggle: (ctx, value) => ctx.setMessageLength(value),
    allowAdd: false,
  },
  musicBed: {
    question: 'What music sits\nunder your voice?',
    subtitle: 'Tap a bed to hear a preview.',
    options: MUSIC_BED_OPTIONS,
    getSelected: (a) => {
      const match = MUSIC_BED_OPTIONS.find((item) => item.id === a.musicBedId);
      return match ? [match.label] : [];
    },
    onToggle: (ctx, value) => {
      const match = MUSIC_BED_OPTIONS.find((item) => item.label === value);
      if (match?.id) {
        void toggleMusicBedPreview(match.id);
        ctx.setMusicBedId(match.id);
      }
    },
    allowAdd: false,
    previewMusic: true,
  },
};

export function ProfileFieldEditScreen({ navigation, route }: Props) {
  const ctx = useOnboarding();
  const config = FIELDS[route.params.field];

  useStopMusicBedOnLeave(config.previewMusic === true);

  return (
    <ChipQuestionScreen
      question={config.question}
      subtitle={config.subtitle}
      helperText={config.helperText}
      options={config.options}
      selected={config.getSelected(ctx.answers)}
      onToggle={(value) => config.onToggle(ctx, value)}
      onAddCustom={
        config.onAddCustom
          ? (value) => config.onAddCustom!(ctx, value)
          : undefined
      }
      addPlaceholder={config.addPlaceholder}
      allowAdd={config.allowAdd ?? true}
      onSubmit={() => {
        if (config.previewMusic) void stopMusicBedPreview();
        navigation.goBack();
      }}
    />
  );
}
