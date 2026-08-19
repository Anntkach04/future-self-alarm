import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChipQuestionScreen } from '../components/ChipQuestionScreen';
import { useOnboarding } from '../context/OnboardingContext';
import {
  ALREADY_YOU_OPTIONS,
  FUTURE_SELF_OPTIONS,
  HARD_MORNING_OPTIONS,
  VOICE_STYLE_OPTIONS,
} from '../data/onboardingOptions';
import { ProfileFieldKey, RootStackParamList } from '../navigation/types';

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
};

const FIELDS: Record<ProfileFieldKey, FieldConfig> = {
  futureSelf: {
    question: 'Write 3 of your\nmain goals in life',
    subtitle: 'Tap + to write your own, chips below.',
    helperText: 'Pick up to three.',
    options: FUTURE_SELF_OPTIONS,
    getSelected: (a) => a.futureSelf,
    onToggle: (ctx, value) => ctx.toggleFutureSelf(value),
    onAddCustom: (ctx, value) => ctx.addFutureSelf(value),
    addPlaceholder: 'Write a goal in your own words',
  },
  alreadyProud: {
    question: "3 things you're\nalready proud of",
    subtitle: 'Tap + to write your own, or pick chips.',
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
    question: 'What tone should\nmornings have?',
    subtitle: 'This shapes how Future You speaks.',
    options: VOICE_STYLE_OPTIONS,
    getSelected: (a) => (a.voiceStyle ? [a.voiceStyle] : []),
    onToggle: (ctx, value) => ctx.setVoiceStyle(value),
    allowAdd: false,
  },
};

export function ProfileFieldEditScreen({ navigation, route }: Props) {
  const ctx = useOnboarding();
  const config = FIELDS[route.params.field];

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
      onSubmit={() => navigation.goBack()}
    />
  );
}
